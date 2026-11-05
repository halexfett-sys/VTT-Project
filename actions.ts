import { randomInt } from "node:crypto";
import { z } from "zod";
import { rollPool } from "../shared/dice.js";
import { defaultSheet, type Campaign, type Token } from "../shared/types.js";
import { trees } from "../shared/trees.js";
import { canEdit, id, newMap } from "./state.js";
const num = z.number().finite(),
  coord = num.min(0).max(20000),
  color = z.string().regex(/^#[0-9a-f]{6}$/i),
  name = z.string().trim().min(1).max(80),
  key = z.string().uuid();
const sheet = z.object({
  wounds: num.min(0).max(9999),
  woundThreshold: num.min(0).max(9999),
  strain: num.min(0).max(9999),
  strainThreshold: num.min(0).max(9999),
  soak: num.min(0).max(9999),
  defense: num.min(0).max(9999),
  credits: num.min(0).max(1e12),
  notes: z.string().max(10000),
});
export function act(
  c: Campaign,
  userId: string,
  event: string,
  input: unknown,
) {
  const m = c.members.find((m) => m.userId === userId);
  if (!m) throw new Error("Join this campaign first");
  const gm = () => {
    if (m.role !== "gm") throw new Error("GM permission required");
  };
  const token = (tokenId: string) => {
    const t = c.tokens.find((t) => t.id === tokenId);
    if (!t || !canEdit(c, userId, t))
      throw new Error("Token permission denied");
    return t;
  };
  const asset = (assetId: string) => {
    const a = c.assets.find((a) => a.id === assetId);
    if (!a || (m.role !== "gm" && a.ownerId !== userId))
      throw new Error("Asset permission denied");
    return a;
  };
  switch (event) {
    case "map:create": {
      gm();
      const p = z.object({ name, assetId: key.optional() }).parse(input);
      const map = newMap(p.name);
      if (p.assetId) {
        const a = asset(p.assetId);
        map.assetId = a.id;
        map.width = a.width;
        map.height = a.height;
      }
      c.maps.push(map);
      c.activeMapId = map.id;
      break;
    }
    case "map:activate": {
      gm();
      const p = z.object({ id: key }).parse(input);
      if (!c.maps.some((m) => m.id === p.id)) throw new Error("Map not found");
      c.activeMapId = p.id;
      break;
    }
    case "map:delete": {
      gm();
      const { ids } = z
        .object({ ids: z.array(key).min(1).max(1000) })
        .parse(input);
      const selected = new Set(ids);
      if (ids.some((id) => !c.maps.some((map) => map.id === id)))
        throw new Error(
          "A selected scene no longer exists. Reopen Manage scenes.",
        );
      // Delete scene instances and their placed tokens, retaining reusable uploads.
      c.maps = c.maps.filter((map) => !selected.has(map.id));
      c.tokens = c.tokens.filter((token) => !selected.has(token.mapId));
      if (!c.maps.length) c.maps.push(newMap());
      if (selected.has(c.activeMapId)) c.activeMapId = c.maps[0].id;
      break;
    }
    case "map:grid": {
      gm();
      const p = z
        .object({
          type: z.enum(["none", "square", "hex"]),
          size: num.min(16).max(256),
          offsetX: num.min(-1000).max(1000),
          offsetY: num.min(-1000).max(1000),
          color,
          snap: z.boolean(),
        })
        .parse(input);
      c.maps.find((m) => m.id === c.activeMapId)!.grid = p;
      break;
    }
    case "fog:stroke": {
      gm();
      const p = z
        .object({
          erase: z.boolean(),
          size: num.min(10).max(2000),
          points: z
            .array(z.object({ x: coord, y: coord }))
            .min(1)
            .max(1000),
        })
        .parse(input);
      const map = c.maps.find((m) => m.id === c.activeMapId)!;
      if (map.fog.length >= 500)
        throw new Error("Fog stroke limit reached; clear fog to reset");
      map.fog.push({ id: id(), ...p });
      break;
    }
    case "fog:clear": {
      gm();
      c.maps.find((m) => m.id === c.activeMapId)!.fog = [];
      break;
    }
    case "token:create": {
      const p = z
        .object({ name, assetId: key.optional(), ownerId: key.optional() })
        .parse(input);
      if (p.assetId) asset(p.assetId);
      const ownerId = m.role === "gm" ? p.ownerId || userId : userId;
      if (!c.members.some((m) => m.userId === ownerId))
        throw new Error("Unknown owner");
      if (c.tokens.length >= 500) throw new Error("Token limit reached");
      c.tokens.push({
        id: id(),
        mapId: c.activeMapId,
        ownerId,
        name: p.name,
        assetId: p.assetId,
        x: Math.min(320, c.maps.find((m) => m.id === c.activeMapId)!.width / 2),
        y: Math.min(
          320,
          c.maps.find((m) => m.id === c.activeMapId)!.height / 2,
        ),
        size: 1,
        rotation: 0,
        status: "",
        hidden: false,
        z: c.tokens.length,
        sheet: defaultSheet(),
      });
      break;
    }
    case "token:move": {
      const p = z.object({ id: key, x: coord, y: coord }).parse(input);
      const t = token(p.id),
        map = c.maps.find((m) => m.id === t.mapId)!;
      let { x, y } = p;
      if (map.grid.snap) {
        const g = map.grid;
        if (g.type === "hex") {
          const radius = g.size / 2,
            q = ((x - g.offsetX) * 2) / 3 / radius,
            r =
              (-(x - g.offsetX) / 3 + (Math.sqrt(3) * (y - g.offsetY)) / 3) /
              radius;
          let cq = Math.round(q),
            cr = Math.round(r),
            cs = Math.round(-q - r);
          const dq = Math.abs(cq - q),
            dr = Math.abs(cr - r),
            ds = Math.abs(cs + q + r);
          if (dq > dr && dq > ds) cq = -cr - cs;
          else if (dr > ds) cr = -cq - cs;
          x = radius * 1.5 * cq + g.offsetX;
          y = radius * Math.sqrt(3) * (cr + cq / 2) + g.offsetY;
        } else if (g.type === "square") {
          x = Math.round((x - g.offsetX) / g.size) * g.size + g.offsetX;
          y = Math.round((y - g.offsetY) / g.size) * g.size + g.offsetY;
        }
      }
      t.x = Math.max(0, Math.min(map.width, x));
      t.y = Math.max(0, Math.min(map.height, y));
      break;
    }
    case "token:update": {
      const p = z
        .object({
          id: key,
          name: name.optional(),
          size: num.min(0.5).max(10).optional(),
          rotation: num.min(-360).max(360).optional(),
          status: z.string().max(30).optional(),
          hidden: z.boolean().optional(),
          ownerId: key.optional(),
          sheet: sheet.optional(),
          assetId: key.nullable().optional(),
          appearance: z
            .object({
              background: color,
              textColor: color,
              outlineColor: color,
              outlineWidth: num.min(0).max(12),
              shape: z.enum(["circle", "square"]),
              imageFit: z.enum(["cover", "contain"]),
            })
            .optional(),
        })
        .parse(input);
      const t = token(p.id);
      if (p.hidden !== undefined || p.ownerId !== undefined) gm();
      if (p.ownerId && !c.members.some((m) => m.userId === p.ownerId))
        throw new Error("Unknown owner");
      if (p.assetId && p.assetId !== t.assetId) asset(p.assetId);
      const { assetId, ...updates } = p;
      Object.assign(t, updates);
      if (assetId === null) delete t.assetId;
      else if (assetId !== undefined) t.assetId = assetId;
      break;
    }
    case "token:delete": {
      const p = z.object({ id: key }).parse(input);
      token(p.id);
      c.tokens = c.tokens.filter((t) => t.id !== p.id);
      break;
    }
    case "token:duplicate": {
      const p = z.object({ id: key }).parse(input);
      const t = token(p.id);
      if (c.tokens.length >= 500) throw new Error("Token limit reached");
      c.tokens.push({
        ...structuredClone(t),
        id: id(),
        x: t.x + 32,
        y: t.y + 32,
        z: c.tokens.length,
      });
      break;
    }
    case "token:layer": {
      const p = z.object({ id: key, front: z.boolean() }).parse(input);
      token(p.id).z = p.front
        ? Math.max(...c.tokens.map((t) => t.z)) + 1
        : Math.min(...c.tokens.map((t) => t.z)) - 1;
      break;
    }
    case "profile:update": {
      const p = z
        .object({
          name: name.optional(),
          color: color.optional(),
          portrait: key.optional(),
          art: z.array(key).max(30).optional(),
        })
        .parse(input);
      if (p.portrait) asset(p.portrait);
      p.art?.forEach(asset);
      Object.assign(m, p);
      break;
    }
    case "profile:tree": {
      const p = z
        .object({
          treeId: z.string().max(100),
          operation: z.enum(["add", "remove", "mark"]),
          node: z.number().int().min(0).optional(),
          completed: z.boolean().optional(),
        })
        .parse(input);
      const tree = trees.find((t) => t.id === p.treeId);
      if (!tree) throw new Error("Unknown tree");
      const list = (m.trees ??= []);
      let entry = list.find((t) => t.treeId === p.treeId);
      if (p.operation === "remove") {
        m.trees = list.filter((t) => t.treeId !== p.treeId);
        break;
      }
      if (!entry) {
        entry = { treeId: p.treeId, completed: [] };
        list.push(entry);
      }
      if (p.operation === "mark") {
        if (p.node === undefined || p.node >= tree.nodes || p.completed === undefined)
          throw new Error("Invalid talent");
        const done = new Set(entry.completed);
        if (p.completed) done.add(p.node);
        else done.delete(p.node);
        entry.completed = [...done].sort((a, b) => a - b);
      }
      break;
    }
    case "handout:show": {
      gm();
      const p = z.object({ assetId: key, title: name }).parse(input);
      asset(p.assetId);
      c.handout = { ...p, id: id() };
      break;
    }
    case "handout:close": {
      gm();
      delete c.handout;
      break;
    }
    case "dice:roll": {
      const pool = z.record(z.string(), num.int().min(0).max(30)).parse(input);
      const roll = rollPool(pool, randomInt);
      c.messages.push({
        id: id(),
        userId,
        name: m.name,
        text: "rolled a dice pool",
        time: Date.now(),
        roll,
      });
      break;
    }
    case "destiny:flip": {
      const p = z.object({ side: z.enum(["light", "dark"]) }).parse(input);
      if (c.destiny[p.side] < 1) throw new Error("No points on that side");
      c.destiny[p.side]--;
      c.destiny[p.side === "light" ? "dark" : "light"]++;
      break;
    }
    case "destiny:set": {
      gm();
      c.destiny = z
        .object({
          light: num.int().min(0).max(30),
          dark: num.int().min(0).max(30),
        })
        .parse(input);
      break;
    }
    case "initiative:add": {
      gm();
      const p = z
        .object({
          type: z.enum(["PC", "NPC"]),
          success: num.int().min(0).max(100),
          advantage: num.int().min(0).max(100),
        })
        .parse(input);
      c.initiative.slots.push({ ...p, id: id(), used: false });
      c.initiative.slots.sort(
        (a, b) =>
          b.success - a.success ||
          b.advantage - a.advantage ||
          (a.type === "PC" ? -1 : 1),
      );
      break;
    }
    case "initiative:use": {
      const p = z.object({ id: key }).parse(input);
      const slot = c.initiative.slots.find((s) => s.id === p.id);
      if (!slot) throw new Error("Unknown slot");
      if (slot.type === "NPC") gm();
      slot.used = !slot.used;
      break;
    }
    case "initiative:next": {
      gm();
      c.initiative.round++;
      c.initiative.slots.forEach((s) => (s.used = false));
      break;
    }
    case "initiative:clear": {
      gm();
      c.initiative = { round: 1, slots: [] };
      break;
    }
    case "chat:send": {
      const p = z
        .object({
          text: z.string().trim().min(1).max(2000),
          to: key.optional(),
        })
        .parse(input);
      if (p.to) {
        gm();
        if (!c.members.some((m) => m.userId === p.to))
          throw new Error("Recipient not in room");
      }
      c.messages.push({
        id: id(),
        userId,
        name: m.name,
        time: Date.now(),
        ...p,
      });
      break;
    }
    default:
      throw new Error("Unknown event");
  }
  c.messages = c.messages.slice(-500);
}
export const events = [
  "map:create",
  "map:activate",
  "map:delete",
  "map:grid",
  "fog:stroke",
  "fog:clear",
  "token:create",
  "token:move",
  "token:update",
  "token:delete",
  "token:duplicate",
  "token:layer",
  "profile:update",
  "profile:tree",
  "handout:show",
  "handout:close",
  "dice:roll",
  "destiny:flip",
  "destiny:set",
  "initiative:add",
  "initiative:use",
  "initiative:next",
  "initiative:clear",
  "chat:send",
];
