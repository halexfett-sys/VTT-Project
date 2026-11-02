import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { Server } from "socket.io";
import { z } from "zod";
import sharp from "sharp";
import { SupabaseTransport } from "./supabase.js";
import { CloudStore } from "./cloud-db.js";
import { CloudStorage } from "./cloud-storage.js";
import { RevisionConflict } from "./cloud-campaigns.js";
import { act, events } from "./actions.js";
import { id, newCampaign, viewFor } from "./state.js";
import { renderMap } from "./map-image.js";
import { registerCloudSaves } from "./cloud-saves.js";
import type { Campaign } from "../shared/types.js";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const cookie = (raw?: string) =>
  raw
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("session="))
    ?.slice(8);
export function createCloudApp(
  transport = new SupabaseTransport(
    process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SECRET_KEY || "",
  ),
) {
  const store = new CloudStore(transport),
    storage = new CloudStorage(
      transport,
      process.env.STORAGE_BUCKET || "vtt-assets",
    );
  const app = express(),
    http = createServer(app);
  app.set("trust proxy", 1);
  app.use(helmet(), cookieParser());
  app.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    if (
      req.headers.origin &&
      req.headers.origin !== `https://${req.headers.host}` &&
      req.headers.origin !== process.env.APP_ORIGIN &&
      req.headers.origin !== `http://${req.headers.host}`
    )
      return res.status(403).json({ error: "Origin rejected" });
    next();
  });
  app.get("/api/config", (_req, res) =>
    res.json({ cloud: true, socketPath: "/api/server/socket.io" }),
  );
  app.get("/api/health", async (_req, res, next) => {
    try {
      await store.rows("vtt_campaigns", "select=id&limit=1");
      res.json({ ok: true, storage: "supabase" });
    } catch (e) {
      next(e);
    }
  });
  app.use(async (req: any, _res, next) => {
    try {
      req.user = req.cookies.session
        ? await store.session(hash(req.cookies.session))
        : undefined;
      next();
    } catch (e) {
      next(e);
    }
  });
  const auth = (req: any, res: any, next: any) =>
    req.user
      ? next()
      : res.status(401).json({ error: "Enter a display name to join" });
  // Shared rate counters enforce limits across function instances.
  const limit =
    (scope: string, max: number) => async (req: any, res: any, next: any) => {
      try {
        const key = hash(`${scope}:${req.user?.id || req.ip}`);
        const r = await transport.call("/rest/v1/rpc/vtt_rate_limit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ p_key: key, p_limit: max }),
        });
        if (!(await r.json()))
          return res
            .status(429)
            .json({ error: "Too many requests. Wait a minute and try again." });
        next();
      } catch (e) {
        next(e);
      }
    };
  const io = new Server(http, {
    path: "/api/server/socket.io",
    transports: ["websocket"],
    maxHttpBufferSize: 262144,
    allowRequest: (req, done) =>
      done(
        null,
        !req.headers.origin ||
          req.headers.origin === `https://${req.headers.host}` ||
          req.headers.origin === process.env.APP_ORIGIN ||
          req.headers.origin === `http://${req.headers.host}`,
      ),
  });
  function broadcast(c: Campaign) {
    for (const s of io.sockets.sockets.values())
      if (
        s.data.campaignId === c.id &&
        c.members.some((m) => m.userId === s.data.user.id)
      ) {
        s.emit("state", viewFor(c, s.data.user.id));
        s.data.revision = c.revision;
      }
  }
  app.use(express.json({ limit: "256kb" }));
  app.get("/api/me", (req: any, res) => res.json(req.user || null));
  app.post("/api/guest", limit("guest", 30), async (req: any, res) => {
    const name = z.string().trim().min(1).max(80).parse(req.body.name);
    if (req.user) return res.json(req.user);
    const userId = id(),
      token = randomBytes(32).toString("hex");
    await store.guest(userId, name);
    await store.write("vtt_sessions", {
      token_hash: hash(token),
      guest_id: userId,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    res
      .cookie("session", token, {
        httpOnly: true,
        secure:
          process.env.VERCEL === "1" || process.env.COOKIE_SECURE === "true",
        sameSite: "strict",
        path: "/",
        maxAge: 30 * 86400000,
      })
      .json({ id: userId, username: name });
  });
  app.post("/api/guest/leave", auth, async (req: any, res) => {
    await transport.call(
      `/rest/v1/vtt_sessions?token_hash=eq.${hash(req.cookies.session)}`,
      { method: "DELETE" },
    );
    res.clearCookie("session").json({ ok: true });
  });
  app.get("/api/rooms", auth, async (req: any, res) => {
    const contains = encodeURIComponent(
      JSON.stringify({ members: [{ userId: req.user.id }] }),
    );
    const rows = await store.rows(
      "vtt_campaigns",
      `state=cs.${contains}&select=id,state->>name`,
    );
    res.json(rows.map((r: any) => ({ id: r.id, name: r.name })));
  });
  app.post("/api/rooms", auth, limit("create", 10), async (req: any, res) => {
    const c = newCampaign(
      z.string().trim().min(1).max(80).parse(req.body.name),
      req.user.id,
      req.user.username,
    );
    await store.save(c);
    res.json({ id: c.id });
  });
  app.post("/api/join", auth, limit("join", 30), async (req: any, res) => {
    const p = z
      .object({
        code: z.string().min(1).max(100),
        name: z.string().trim().min(1).max(80),
        color: z.string().regex(/^#[a-f0-9]{6}$/i),
      })
      .parse(req.body);
    const row = await store.invite(p.code);
    if (!row) return res.status(404).json({ error: "Invite not found" });
    const c = await store.get(row.id);
    if (!c.members.some((m) => m.userId === req.user.id)) {
      c.members.push({
        userId: req.user.id,
        name: p.name,
        color: p.color,
        role: "player",
        art: [],
      });
      await store.save(c);
      broadcast(c);
    }
    res.json({ id: c.id });
  });
  // Large files travel as bounded chunks, never as a >4.5 MB function request.
  app.post(
    "/api/transfers",
    auth,
    limit("transfer", 8),
    async (req: any, res) => {
      const p = z
        .object({
          size: z
            .number()
            .int()
            .min(1)
            .max(128 * 1024 * 1024),
          name: z.string().max(200),
          type: z.enum(["image", "save"]),
        })
        .parse(req.body);
      if (p.type === "image" && p.size > 20 * 1024 * 1024)
        throw new Error("Images must be 20 MB or smaller");
      const transfer = id();
      await store.write("vtt_transfers", {
        id: transfer,
        guest_id: req.user.id,
        size: p.size,
        name: p.name,
        type: p.type,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      });
      res.json({ id: transfer, chunkSize: 2 * 1024 * 1024 });
    },
  );
  const transfer = async (req: any) => {
    const key = z
      .string()
      .uuid()
      .parse(req.params.transfer || req.body.transfer);
    const rows = await store.rows(
      "vtt_transfers",
      `id=eq.${key}&guest_id=eq.${req.user.id}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
    );
    if (!rows[0]) throw new Error("Upload expired or not owned by you");
    return rows[0];
  };
  app.put(
    "/api/transfers/:transfer/:part",
    auth,
    limit("chunks", 150),
    express.raw({ type: "application/octet-stream", limit: "2mb" }),
    async (req: any, res) => {
      const t = await transfer(req),
        part = z.coerce.number().int().min(0).max(63).parse(req.params.part),
        expected = Math.min(2 * 1024 * 1024, t.size - part * 2 * 1024 * 1024);
      if (
        !Buffer.isBuffer(req.body) ||
        expected <= 0 ||
        req.body.length !== expected
      )
        throw new Error("Invalid upload chunk");
      await transport.call(`/storage/v1/object/vtt-transfers/${t.id}/${part}`, {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-upsert": "true",
        },
        body: new Uint8Array(req.body),
      });
      res.json({ ok: true });
    },
  );
  const ingest = async (req: any, _res: any, next: any) => {
    try {
      const t = await transfer(req);
      if ((req.path.endsWith("/assets") ? "image" : "save") !== t.type)
        throw new Error("Wrong upload type");
      const chunks = [];
      for (let i = 0; i < Math.ceil(t.size / (2 * 1024 * 1024)); i++) {
        const r = await transport.call(
          `/storage/v1/object/vtt-transfers/${t.id}/${i}`,
        );
        const b = Buffer.from(await r.arrayBuffer());
        if (
          b.length !== Math.min(2 * 1024 * 1024, t.size - i * 2 * 1024 * 1024)
        )
          throw new Error("Invalid chunk length");
        chunks.push(b);
      }
      req.file = { buffer: Buffer.concat(chunks), originalname: t.name };
      await transport.call(`/storage/v1/object/vtt-transfers`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prefixes: chunks.map((_, i) => `${t.id}/${i}`),
        }),
      });
      await transport.call(`/rest/v1/vtt_transfers?id=eq.${t.id}`, {
        method: "DELETE",
      });
      next();
    } catch (e) {
      next(e);
    }
  };
  app.post(
    "/api/rooms/:room/assets",
    auth,
    limit("assets", 20),
    ingest,
    async (req: any, res) => {
      const c = await store.member(req.params.room, req.user.id),
        kind = z.enum(["map", "token", "art", "handout"]).parse(req.body.kind);
      if (
        c.members.find((m) => m.userId === req.user.id)!.role !== "gm" &&
        ["map", "handout"].includes(kind)
      )
        throw new Error("GM permission required");
      const image = sharp(req.file.buffer, {
          limitInputPixels: 40000000,
          animated: false,
        }),
        meta = await image.metadata();
      if (
        !["png", "jpeg", "webp"].includes(meta.format || "") ||
        !meta.width ||
        !meta.height ||
        meta.width > 20000 ||
        meta.height > 20000
      )
        throw new Error("Invalid image");
      const { data, info } = await image
        .rotate()
        .webp({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
      const asset = {
        id: id(),
        ownerId: req.user.id,
        kind,
        name:
          req.file.originalname.replace(/[^a-zA-Z0-9 ._-]/g, "").slice(0, 80) ||
          "Image",
        width: info.width,
        height: info.height,
      };
      await storage.put(`${asset.id}.webp`, data);
      const fresh = await store.member(c.id, req.user.id);
      fresh.assets.push(asset);
      await store.save(fresh);
      broadcast(fresh);
      res.json(asset);
    },
  );
  const stream = async (res: any, buffer: Buffer, type: string) => {
    res.type(type);
    res.flushHeaders();
    for (let i = 0; i < buffer.length; i += 64 * 1024) {
      if (res.destroyed) return;
      if (!res.write(buffer.subarray(i, i + 64 * 1024)))
        await once(res, "drain");
    }
    res.end();
  };
  app.get("/api/rooms/:room/assets/:asset", auth, async (req: any, res) => {
    const c = await store.member(req.params.room, req.user.id);
    if (!viewFor(c, req.user.id).assets.some((a) => a.id === req.params.asset))
      throw new Error("Asset access denied");
    await stream(res, await storage.get(`${req.params.asset}.webp`), "webp");
  });
  app.get("/api/rooms/:room/map/:map", auth, async (req: any, res) => {
    const c = await store.member(req.params.room, req.user.id),
      gm = c.members.find((m) => m.userId === req.user.id)!.role === "gm",
      m = c.maps.find((m) => m.id === req.params.map);
    if (!m || (!gm && m.id !== c.activeMapId))
      throw new Error("Map access denied");
    await stream(res, await renderMap(m, storage, !gm), "webp");
  });
  registerCloudSaves(
    app,
    store,
    storage,
    auth,
    broadcast,
    io,
    ingest,
    async (res: any, json: string) => stream(res, Buffer.from(json), "json"),
  );
  io.use(async (s, next) => {
    try {
      const raw = cookie(s.request.headers.cookie),
        user = raw ? await store.session(hash(raw)) : undefined;
      if (!user) throw new Error("Enter a display name to join");
      s.data.user = user;
      s.data.session = raw;
      next();
    } catch (e) {
      next(e as Error);
    }
  });
  io.on("connection", (s) => {
    let chain = Promise.resolve(),
      count = 0,
      window = Date.now();
    const enqueue = (fn: () => Promise<void>) => {
      chain = chain.then(fn).catch(() => {});
    };
    s.on("room:join", (p, ack) =>
      enqueue(async () => {
        try {
          const c = await store.member(
            z.string().uuid().parse(p.roomId),
            s.data.user.id,
          );
          s.data.campaignId = c.id;
          s.data.revision = c.revision;
          s.emit("state", viewFor(c, s.data.user.id));
          ack?.({ ok: true });
        } catch (e) {
          ack?.({ error: (e as Error).message });
        }
      }),
    );
    for (const event of events)
      s.on(event, (payload, ack) => {
        if (Date.now() - window > 1000) {
          count = 0;
          window = Date.now();
        }
        if (++count > 40) return ack?.({ error: "Too many actions" });
        enqueue(async () => {
          try {
            if (!(await store.session(hash(s.data.session))))
              throw new Error("Session expired");
            const c = await store.member(s.data.campaignId, s.data.user.id);
            act(c, s.data.user.id, event, payload);
            await store.save(c);
            broadcast(c);
            ack?.({ ok: true, revision: c.revision });
          } catch (e) {
            ack?.({
              error:
                e instanceof z.ZodError
                  ? "Invalid input"
                  : (e as Error).message,
            });
          }
        });
      });
    // Durable revision polling bridges instances without publishing hidden state to browsers.
    let polling = false;
    const timer = setInterval(async () => {
      if (polling || !s.data.campaignId) return;
      polling = true;
      try {
        if (!(await store.session(hash(s.data.session))))
          return s.disconnect(true);
        const c = await store.member(s.data.campaignId, s.data.user.id);
        if (c.revision > s.data.revision) {
          s.data.revision = c.revision;
          s.emit("state", viewFor(c, s.data.user.id));
        }
      } catch {
        s.disconnect(true);
      } finally {
        polling = false;
      }
    }, 1000);
    s.on("disconnect", () => clearInterval(timer));
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API endpoint not found" }),
  );
  app.use((e: any, _req: any, res: any, _next: any) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res
      .status(e instanceof RevisionConflict ? 409 : 400)
      .json({
        error:
          e instanceof z.ZodError
            ? "Invalid input"
            : e.message || "Request failed",
      });
  });
  return { app, http, io, store };
}
