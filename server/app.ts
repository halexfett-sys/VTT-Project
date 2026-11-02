import express from "express";
import { renderMap } from "./map-image";
import {registerSaves} from "./saves";
import { createServer } from "node:http";
import {randomBytes,createHash} from "node:crypto";
import path from "node:path";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { Server } from "socket.io";
import { z } from "zod";
import { openDatabase } from "./db";
import { LocalStorage } from "./storage";
import { id, newCampaign, viewFor } from "./state";
import { act, events } from "./actions";
import type { Campaign } from "../shared/types";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function createApp(root = process.env.DATA_DIR || "data") {
  const store = openDatabase(root),
    storage = new LocalStorage(path.join(root, "uploads"));
  const app = express(),
    http = createServer(app);
  const origin = process.env.APP_ORIGIN;
  const sameOrigin = (req: any) =>
    !req.headers.origin ||
    req.headers.origin === (origin || `${req.protocol}://${req.headers.host}`);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "256kb" }), cookieParser());
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method) && !sameOrigin(req))
      return res.status(403).json({ error: "Origin rejected" });
    next();
  });
  const session = (raw: string | undefined) =>
    raw
      ? (store.db
          .prepare(
            "SELECT users.id,COALESCE(users.display_name,users.username) AS username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?",
          )
          .get(hash(raw), Date.now()) as
          { id: string; username: string } | undefined)
      : undefined;
  app.use((req: any, _res, next) => {
    req.user = session(req.cookies.session);
    next();
  });
  const auth = (req: any, res: any, next: any) =>
    req.user ? next() : res.status(401).json({ error: "Enter a display name to join" });
  const member = (campaignId: string, userId: string) => {
    const c = store.get(campaignId);
    if (!c.members.some((m) => m.userId === userId))
      throw new Error("Campaign access denied");
    return c;
  };
  const io = new Server(http, {
    maxHttpBufferSize: 256 * 1024,
    allowRequest: (req, callback) =>
      callback(
        null,
        !req.headers.origin ||
          req.headers.origin === (origin || `http://${req.headers.host}`) ||
          req.headers.origin === `https://${req.headers.host}`,
      ),
  });
  function broadcast(c: Campaign) {
    for (const socket of io.sockets.sockets.values())
      if (socket.data.campaignId === c.id)
        socket.emit("state", viewFor(c, socket.data.user.id));
  }
  app.post('/api/guest', rateLimit({windowMs:60000,limit:30}), (req:any,res)=>{
    const name=z.string().trim().min(1).max(80).parse(req.body.name);
    if(req.user)return res.json(req.user);
    const userId=id(),token=randomBytes(32).toString('hex');
    store.db.prepare('INSERT INTO users(id,username,password,display_name) VALUES(?,?,?,?)').run(userId,`guest-${userId}`,'',name);
    store.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),userId,Date.now()+30*86400000);
    res.cookie('session',token,{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:30*86400000,path:'/'}).json({id:userId,username:name});
  });
  app.post('/api/auth/:mode',(_req,res)=>res.status(410).json({error:'Accounts have been removed. Enter as a guest instead.'}));
  app.post("/api/guest/leave", auth, (req: any, res) => {
    store.db
      .prepare("DELETE FROM sessions WHERE token=?")
      .run(hash(req.cookies.session));
    for (const s of io.sockets.sockets.values())
      if (s.data.session === req.cookies.session) s.disconnect(true);
    res.clearCookie("session").json({ ok: true });
  });
  app.get("/api/config", (_req,res)=>res.json({cloud:false}));
  app.get("/api/me", (req: any, res) => res.json(req.user || null));
  app.get("/api/rooms", auth, (req: any, res) =>
    res.json(
      store.db
        .prepare(
          "SELECT campaigns.id,campaigns.name FROM campaigns JOIN memberships ON campaign_id=campaigns.id WHERE user_id=?",
        )
        .all(req.user.id),
    ),
  );
  app.post("/api/rooms", auth, (req: any, res) => {
    const name = z.string().trim().min(1).max(80).parse(req.body.name);
    const c = newCampaign(name, req.user.id, req.user.username);
    store.save(c);
    res.json({ id: c.id });
  });
  app.post("/api/join", auth, (req: any, res) => {
    const p = z
      .object({
        code: z.string().min(1).max(100),
        name: z.string().trim().min(1).max(80),
        color: z.string().regex(/^#[0-9a-f]{6}$/i),
      })
      .parse(req.body);
    const row = store.db
      .prepare("SELECT id FROM campaigns WHERE invite=?")
      .get(p.code) as { id: string } | undefined;
    if (!row) return res.status(404).json({ error: "Invite not found" });
    const c = store.get(row.id);
    if (!c.members.some((m) => m.userId === req.user.id)) {
      c.members.push({
        userId: req.user.id,
        name: p.name,
        color: p.color,
        role: "player",
        art: [],
      });
      store.save(c);
      broadcast(c);
    }
    res.json({ id: c.id });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) =>
      cb(
        null,
        ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype),
      ),
  });
  app.post(
    "/api/rooms/:room/assets",
    auth,
    rateLimit({ windowMs: 60000, limit: 20 }),
    upload.single("file"),
    async (req: any, res, next) => {
      try {
        const c = member(req.params.room, req.user.id);
        const kind = z
          .enum(["map", "token", "art", "handout"])
          .parse(req.body.kind);
        const gm =
          c.members.find((m) => m.userId === req.user.id)!.role === "gm";
        if (!gm && (kind === "map" || kind === "handout"))
          throw new Error("GM permission required");
        if (!req.file)
          throw new Error("Choose a PNG, JPG, or WebP image, up to 20 MB");
        const decoded = sharp(req.file.buffer, {
          limitInputPixels: 40_000_000,
          animated: false,
        });
        const meta = await decoded.metadata();
        if ((meta.width || 0) > 20000 || (meta.height || 0) > 20000)
          throw new Error("Image dimensions must be 20,000 pixels or smaller");
        if (!["png", "jpeg", "webp"].includes(meta.format || ""))
          throw new Error("Unsupported image contents");
        const { data, info } = await decoded
          .rotate()
          .webp({ quality: 90 })
          .toBuffer({ resolveWithObject: true });
        const assetId = id();
        await storage.put(`${assetId}.webp`, data);
        // Re-read after async decode to avoid overwriting simultaneous socket mutations.
        const fresh = member(c.id, req.user.id);
        const asset = {
          id: assetId,
          ownerId: req.user.id,
          kind,
          name:
            String(req.file.originalname)
              .replace(/[^a-zA-Z0-9 ._-]/g, "")
              .slice(0, 80) || "Uploaded image",
          width: info.width,
          height: info.height,
        };
        store.db
          .prepare("INSERT INTO assets VALUES(?,?,?,?)")
          .run(assetId, c.id, req.user.id, `${assetId}.webp`);
        fresh.assets.push(asset);
        store.save(fresh);
        broadcast(fresh);
        res.json(asset);
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/rooms/:room/assets/:asset",
    auth,
    async (req: any, res, next) => {
      try {
        const c = member(req.params.room, req.user.id),
          v = viewFor(c, req.user.id);
        if (!v.assets.some((a) => a.id === req.params.asset))
          throw new Error("Asset access denied");
        res
          .set("Cache-Control", "private, no-store")
          .type("webp")
          .send(await storage.get(`${req.params.asset}.webp`));
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/rooms/:room/map/:map", auth, async (req: any, res, next) => {
    try {
      const c = member(req.params.room, req.user.id),
        gm = c.members.find((m) => m.userId === req.user.id)!.role === "gm",
        map = c.maps.find((m) => m.id === req.params.map);
      if (!map || (!gm && map.id !== c.activeMapId))
        throw new Error("Map access denied");
      res.set("Cache-Control","private, no-store").type('webp').send(await renderMap(map,storage,!gm));
    } catch (e) {
      next(e);
    }
  });
  registerSaves(app,store,storage,auth,broadcast,io);
  io.use((socket, next) => {
    const raw = socket.request.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("session="))
      ?.slice(8);
    const user = session(raw);
    if (!user) return next(new Error("Enter a display name to join"));
    socket.data.user = user;
    socket.data.session = raw;
    next();
  });
  io.on("connection", (socket) => {
    let budget = 120,
      reset = Date.now();
    // room:join restores a filtered authoritative snapshot after every reconnect.
    socket.on("room:join", (payload, ack) => {
      try {
        if (!session(socket.data.session)) throw new Error("Session expired");
        const p = z.object({ roomId: z.string().uuid() }).parse(payload);
        const c = member(p.roomId, socket.data.user.id);
        socket.data.campaignId = c.id;
        socket.emit("state", viewFor(c, socket.data.user.id));
        if (typeof ack === "function") ack({ ok: true });
      } catch (e) {
        if (typeof ack === "function") ack({ error: (e as Error).message });
      }
    });
    // Every mutation is validated, authorized, committed, then broadcast per viewer.
    for (const event of events)
      socket.on(event, (payload, ack) => {
        try {
          if (Date.now() - reset > 1000) {
            budget = 120;
            reset = Date.now();
          }
          if (--budget < 0) throw new Error("Too many actions");
          if (!session(socket.data.session)) throw new Error("Session expired");
          const c = member(socket.data.campaignId, socket.data.user.id);
          act(c, socket.data.user.id, event, payload);
          store.save(c);
          broadcast(c);
          if (typeof ack === "function")
            ack({ ok: true, revision: c.revision });
        } catch (e) {
          if (typeof ack === "function")
            ack({
              error:
                e instanceof z.ZodError
                  ? "Invalid action data"
                  : (e as Error).message,
            });
        }
      });
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // Unknown API paths must not fall through to the frontend HTML fallback.
  app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found. Check that the client and server versions match." }));
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
  app.use((err: any, _req: any, res: any, _next: any) =>
    res
      .status(
        err instanceof z.ZodError
          ? 400
          : err.code === "LIMIT_FILE_SIZE"
            ? 413
            : 400,
      )
      .json({
        error:
          err instanceof z.ZodError
            ? "Invalid input"
            : err.code === "LIMIT_FILE_SIZE"
              ? (_req.path === "/api/restore" || _req.path === "/api/join-save" ? "Save must be 128 MB or smaller" : "Image must be 20 MB or smaller")
              : err.message || "Request failed",
      }),
  );
  return { app, http, io, store };
}
