import type { Express } from "express";
import type { Server } from "socket.io";
import multer from "multer";
import sharp from "sharp";
import { randomBytes, createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { saveSchema, type SaveFile } from "./save-schema";
import type { CloudStore } from "./cloud-db";
import type { Storage } from "./storage";
import type { Campaign, Asset } from "../shared/types";
import { id, newCampaign, viewFor } from "./state";
import { renderMap } from "./map-image";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const MAX = 128 * 1024 * 1024;
function checkReferences(file: SaveFile) {
  const assets = file.kind === "player" ? file.assets : file.campaign.assets;
  const assetIds = new Set(assets.map((a) => a.id));
  if (
    assetIds.size !== assets.length ||
    new Set(file.files.map((f) => f.id)).size !== file.files.length
  )
    throw new Error("Duplicate image IDs in save");
  if (
    file.files.length !== assets.length ||
    file.files.some((f) => !assetIds.has(f.id))
  )
    throw new Error("Save is missing image data");
  const ref = (v: string | undefined) => {
    if (v && !assetIds.has(v))
      throw new Error("Save contains a missing image reference");
  };
  const tokens = file.kind === "player" ? file.tokens : file.campaign.tokens;
  tokens.forEach((t) => ref(t.assetId));
  const members =
    file.kind === "player" ? [file.profile] : file.campaign.members;
  members.forEach((m) => {
    ref(m.portrait);
    m.art.forEach(ref);
  });
  if (file.kind === "player") {
    if (tokens.some((t) => t.ownerId !== file.profile.userId))
      throw new Error("Player save contains another owner’s tokens");
  } else {
    const c = file.campaign,
      memberIds = new Set(c.members.map((m) => m.userId)),
      maps = new Set(c.maps.map((m) => m.id));
    if (
      memberIds.size !== c.members.length ||
      maps.size !== c.maps.length ||
      !memberIds.has(file.exporterId) ||
      !maps.has(c.activeMapId)
    )
      throw new Error("Invalid campaign references");
    if (
      c.tokens.some((t) => !memberIds.has(t.ownerId) || !maps.has(t.mapId)) ||
      c.assets.some((a) => !memberIds.has(a.ownerId))
    )
      throw new Error("Invalid token or asset owner");
    c.maps.forEach((m) => {
      ref(m.assetId);
      if (m.width * m.height > 40_000_000) throw new Error("Map too large");
    });
    ref(c.handout?.assetId);
    if (
      c.messages.some(
        (m) => !memberIds.has(m.userId) || (m.to && !memberIds.has(m.to)),
      )
    )
      throw new Error("Invalid chat sender");
  }
}
export function registerCloudSaves(
  app: Express,
  store: CloudStore,
  storage: Storage,
  auth: any,
  broadcast: (c: Campaign) => void,
  io: Server,
  ingest?: any,
  deliver?: any,
) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX, files: 1, fields: 4 },
  });
  const limiter = rateLimit({ windowMs: 60000, limit: 8 });
  const get = async (room: string, user: string) => {
    const c = await store.get(room);
    if (!c.members.some((m) => m.userId === user))
      throw new Error("Campaign access denied");
    return c;
  };
  async function parse(req: any) {
    if (!req.file) throw new Error("Choose an Outer Rim save file");
    let json;
    try {
      json = JSON.parse(req.file.buffer.toString("utf8"));
    } catch {
      throw new Error("Invalid save file JSON");
    }
    const result = saveSchema.safeParse(json);
    if (!result.success)
      throw new Error("Invalid or unsupported save file (expected version 1)");
    checkReferences(result.data);
    return result.data;
  }
  async function decode(file: SaveFile) {
    const records = file.kind === "player" ? file.assets : file.campaign.assets;
    const result = new Map<string, { asset: Asset; data: Buffer }>();
    let total = 0;
    for (const f of file.files) {
      const bytes = Buffer.from(f.data, "base64");
      total += bytes.length;
      if (total > 90 * 1024 * 1024 || bytes.length > 20 * 1024 * 1024)
        throw new Error("Save images exceed import limits");
      const img = sharp(bytes, {
          limitInputPixels: 40_000_000,
          animated: false,
        }),
        meta = await img.metadata();
      if (
        !["png", "jpeg", "webp"].includes(meta.format || "") ||
        (meta.width || 0) > 20000 ||
        (meta.height || 0) > 20000
      )
        throw new Error("Invalid image inside save");
      const { data, info } = await img
        .rotate()
        .webp({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
      result.set(f.id, {
        asset: {
          ...records.find((a) => a.id === f.id)!,
          id: id(),
          width: info.width,
          height: info.height,
        },
        data,
      });
    }
    // Only validated, re-encoded image data reaches storage. Original paths are never used.
    for (const { asset, data } of result.values())
      await storage.put(`${asset.id}.webp`, data);
    return result;
  }
  app.get(
    "/api/rooms/:room/export/:kind",
    auth,
    limiter,
    async (req: any, res, next) => {
      try {
        const c = await get(req.params.room, req.user.id),
          me = c.members.find((m) => m.userId === req.user.id)!;
        const base = {
          format: "outer-rim-save" as const,
          version: 1 as const,
          exportedAt: new Date().toISOString(),
        };
        let file: SaveFile;
        if (req.params.kind === "player") {
          const tokens = c.tokens
            .filter((t) => t.ownerId === me.userId)
            .map((t) => ({ ...t, hidden: false }));
          const referenced = new Set([
            ...tokens.map((t) => t.assetId),
            me.portrait,
            ...me.art,
          ]);
          const assets = c.assets.filter(
            (a) =>
              (a.ownerId === me.userId && ["token", "art"].includes(a.kind)) ||
              referenced.has(a.id),
          );
          const resumeKey = randomBytes(32).toString("hex");
          await store.db
            .prepare("INSERT INTO save_keys VALUES(?,?,?)")
            .run(c.id, me.userId, hash(resumeKey));
          file = {
            ...base,
            kind: "player",
            profile: me,
            tokens,
            assets,
            resumeKey,
            files: [],
          };
        } else if (req.params.kind === "table") {
          const campaign = viewFor(c, me.userId),
            gm = me.role === "gm";
          campaign.invite = "";
          file = {
            ...base,
            kind: gm ? "campaign" : "table",
            campaign,
            exporterId: me.userId,
            claims: gm
              ? ((await store.db
                  .prepare(
                    "SELECT user_id AS memberId,hash FROM save_keys WHERE campaign_id=?",
                  )
                  .all(c.id)) as { memberId: string; hash: string }[])
              : [],
            files: [],
          };
          if (!gm) {
            const m = campaign.maps[0],
              assetId = id();
            const data = await renderMap(
              c.maps.find((x) => x.id === m.id)!,
              storage,
              true,
            );
            m.assetId = assetId;
            campaign.assets.push({
              id: assetId,
              ownerId: me.userId,
              kind: "map",
              name: m.name,
              width: m.width,
              height: m.height,
            });
            file.files.push({ id: assetId, data: data.toString("base64") });
          }
        } else throw new Error("Unknown export type");
        const assets =
          file.kind === "player" ? file.assets : file.campaign.assets;
        let length = file.files.reduce((n, f) => n + f.data.length, 0);
        for (const a of assets) {
          if (file.files.some((f) => f.id === a.id)) continue;
          const data = (await storage.get(`${a.id}.webp`)).toString("base64");
          length += data.length;
          if (length > MAX - 5 * 1024 * 1024)
            throw new Error(
              "Save exceeds 128 MB; reduce image library size before exporting",
            );
          file.files.push({ id: a.id, data });
        }
        const json = JSON.stringify(file);
        if (Buffer.byteLength(json) > MAX)
          throw new Error("Save exceeds 128 MB");
        if (deliver) {
          await deliver(res, json);
          return;
        }
        res
          .set({
            "Cache-Control": "no-store",
            "Content-Disposition": `attachment; filename="outer-rim-${file.kind}-${new Date().toISOString().slice(0, 10)}.json"`,
          })
          .type("json")
          .send(json);
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/restore",
    auth,
    limiter,
    ingest || upload.single("file"),
    async (req: any, res, next) => {
      try {
        const file = await parse(req);
        if (file.kind === "player")
          throw new Error("Use Join with player save for a player file");
        const decoded = await decode(file),
          c = structuredClone(file.campaign),
          users = new Map<string, string>();
        for (const m of c.members) {
          const nextId = m.userId === file.exporterId ? req.user.id : id();
          users.set(m.userId, nextId);
          if (nextId !== req.user.id)
            await store.db
              .prepare(
                "INSERT INTO users(id,username,password,display_name) VALUES(?,?,?,?)",
              )
              .run(nextId, `guest-${nextId}`, "", m.name);
        }
        const image = (old: string | undefined) =>
          old ? decoded.get(old)!.asset.id : undefined;
        const oldMembers = structuredClone(c.members);
        c.id = id();
        c.invite = randomBytes(16).toString("hex");
        c.revision = 0;
        c.members = c.members.map((m) => ({
          ...m,
          userId: users.get(m.userId)!,
          role: m.userId === file.exporterId ? "gm" : "player",
          portrait: image(m.portrait),
          art: m.art.map((a) => image(a)!),
        }));
        c.tokens = c.tokens.map((t) => ({
          ...t,
          id: id(),
          ownerId: users.get(t.ownerId)!,
          assetId: image(t.assetId),
        }));
        c.maps = c.maps.map((m) => ({ ...m, assetId: image(m.assetId) }));
        c.assets = [...decoded.values()].map(({ asset }) => ({
          ...asset,
          ownerId: users.get(asset.ownerId)!,
        }));
        c.messages = c.messages.map((m) => ({
          ...m,
          userId: users.get(m.userId)!,
          to: m.to ? users.get(m.to) : undefined,
        }));
        if (c.handout)
          c.handout = {
            ...c.handout,
            id: id(),
            assetId: image(c.handout.assetId)!,
          };
        await store.save(c);
        for (const a of c.assets)
          await store.db
            .prepare("INSERT INTO assets VALUES(?,?,?,?)")
            .run(a.id, c.id, a.ownerId, `${a.id}.webp`);
        if (file.kind === "campaign")
          for (const claim of file.claims) {
            if (
              oldMembers.find((m) => m.userId === claim.memberId)?.role ===
              "player"
            )
              await store.db
                .prepare("INSERT OR IGNORE INTO save_keys VALUES(?,?,?)")
                .run(c.id, users.get(claim.memberId)!, claim.hash);
          }
        res.json({ id: c.id });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/join-save",
    auth,
    limiter,
    ingest || upload.single("file"),
    async (req: any, res, next) => {
      try {
        const file = await parse(req);
        if (file.kind !== "player")
          throw new Error("Choose a player save, not a campaign save");
        const code = String(req.body.code || "");
        const row = req.body.roomId
          ? { id: (await get(String(req.body.roomId), req.user.id)).id }
          : ((await store.db
              .prepare("SELECT id FROM campaigns WHERE invite=?")
              .get(code)) as { id: string } | undefined);
        if (!row) throw new Error("Invite not found");
        const decoded = await decode(file),
          c = await store.get(row.id),
          keyHash = hash(file.resumeKey);
        const claim = (await store.db
          .prepare(
            "SELECT user_id FROM save_keys WHERE campaign_id=? AND hash=?",
          )
          .get(c.id, keyHash)) as { user_id: string } | undefined;
        const oldId =
          claim &&
          c.members.find((m) => m.userId === claim.user_id)?.role === "player"
            ? claim.user_id
            : req.user.id;
        const existing = c.members.find((m) => m.userId === req.user.id),
          old = c.members.find((m) => m.userId === oldId);
        if (oldId !== req.user.id && existing)
          throw new Error(
            "This browser already joined this table. Use a separate browser profile to restore another player.",
          );
        const image = (old: string | undefined) =>
          old ? decoded.get(old)!.asset.id : undefined;
        const profile = {
          ...file.profile,
          userId: req.user.id,
          role: existing?.role || ("player" as const),
          portrait: image(file.profile.portrait),
          art: file.profile.art.map((a) => image(a)!),
        };
        c.members = c.members.filter(
          (m) => m.userId !== oldId && m.userId !== req.user.id,
        );
        c.members.push(profile);
        c.tokens = c.tokens.filter(
          (t) => t.ownerId !== oldId && t.ownerId !== req.user.id,
        );
        const map = c.maps.find((m) => m.id === c.activeMapId)!;
        c.tokens.push(
          ...file.tokens.map((t) => ({
            ...t,
            id: id(),
            ownerId: req.user.id,
            mapId: c.maps.some((m) => m.id === t.mapId) ? t.mapId : map.id,
            x: Math.min(
              t.x,
              (c.maps.find((m) => m.id === t.mapId) || map).width,
            ),
            y: Math.min(
              t.y,
              (c.maps.find((m) => m.id === t.mapId) || map).height,
            ),
            hidden: false,
            assetId: image(t.assetId),
          })),
        );
        if (c.tokens.length > 500)
          throw new Error("Table token limit exceeded");
        if (oldId !== req.user.id) {
          c.assets.forEach((a) => {
            if (a.ownerId === oldId) a.ownerId = req.user.id;
          });
          c.messages.forEach((m) => {
            if (m.userId === oldId) m.userId = req.user.id;
            if (m.to === oldId) m.to = req.user.id;
          });
        }
        const imported = [...decoded.values()].map(({ asset }) => ({
          ...asset,
          ownerId: req.user.id,
        }));
        c.assets.push(...imported);
        await store.save(c);
        for (const a of imported)
          await store.db
            .prepare("INSERT INTO assets VALUES(?,?,?,?)")
            .run(a.id, c.id, a.ownerId, `${a.id}.webp`);
        await store.db
          .prepare(
            "UPDATE save_keys SET user_id=? WHERE campaign_id=? AND user_id=?",
          )
          .run(req.user.id, c.id, oldId);
        await store.db
          .prepare("INSERT OR IGNORE INTO save_keys VALUES(?,?,?)")
          .run(c.id, req.user.id, keyHash);
        if (oldId !== req.user.id) {
          await store.db
            .prepare(
              "DELETE FROM memberships WHERE campaign_id=? AND user_id=?",
            )
            .run(c.id, oldId);
          for (const s of io.sockets.sockets.values())
            if (s.data.campaignId === c.id && s.data.user.id === oldId)
              s.disconnect(true);
        }
        broadcast(c);
        res.json({ id: c.id });
      } catch (e) {
        next(e);
      }
    },
  );
}
