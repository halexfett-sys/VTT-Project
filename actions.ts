import { characterSchema, characterTokenStats } from "../shared/character.js";
import { trees } from "../shared/trees.js";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { rollPool } from "../shared/dice.js";
import { defaultSheet, type Campaign, type Member, type Token } from "../shared/types.js";
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
const appearance = z.object({
  background: color,
  textColor: color,
  outlineColor: color,
  outlineWidth: num.min(0).max(12),
  shape: z.enum(["circle", "square"]),
  imageFit: z.enum(["cover", "contain"]),
  imageScale: num.min(0.25).max(4).optional(),
  imageX: num.min(-1).max(1).optional(),
  imageY: num.min(-1).max(1).optional(),
  backImageScale: num.min(0.25).max(4).optional(),
  backImageX: num.min(-1).max(1).optional(),
  backImageY: num.min(-1).max(1).optional(),
});
/** Copy wound/strain thresholds, soak and defense from a member's character sheet onto their token.
 *  Targets are the tokens named like the character, or the member's only token. Current wounds and strain are kept. */
export function applyCharacterToTokens(c: Campaign, m: Member) {
  if (!m.character) return;
  const mine = c.tokens.filter((t) => t.ownerId === m.userId);
  const nm = (m.character.name ?? "").trim().toLowerCase();
  const named = nm ? mine.filter((t) => t.name.trim().toLowerCase() === nm) : [];
  const targets = named.length ? named : mine.length === 1 ? mine : [];
  for (const t of targets) t.sheet = { ...t.sheet, ...characterTokenStats(m.character) };
}
/** Remove a member and hand any tokens they controlled to the first GM so nothing is orphaned. */
export function removeMember(c: Campaign, userId: string) {
  const heir = c.members.find((x) => x.role === "gm" && x.userId !== userId);
  if (!heir) throw new Error("No GM to take over this player's tokens");
  for (const t of c.tokens) if (t.ownerId === userId) t.ownerId = heir.userId;
  c.members = c.members.filter((x) => x.userId !== userId);
}
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
        .object({
          name,
          assetId: key.optional(),
          backAssetId: key.optional(),
          ownerId: key.optional(),
          size: num.min(0.5).max(10).optional(),
          rotation: num.min(-360).max(360).optional(),
          status: z.string().max(30).optional(),
          hidden: z.boolean().optional(),
          sheet: sheet.optional(),
          appearance: appearance.optional(),
        })
        .parse(input);
      if (p.assetId) asset(p.assetId);
      if (p.backAssetId) asset(p.backAssetId);
      // Players always own what they create and cannot create hidden tokens; ownerId and hidden are GM options.
      const ownerId = m.role === "gm" ? p.ownerId || userId : userId;
      if (!c.members.some((m) => m.userId === ownerId))
        throw new Error("Unknown owner");
      if (c.tokens.length >= 500) throw new Error("Token limit reached");
      const placeOn = c.maps.find((m) => m.id === c.activeMapId)!;
      c.tokens.push({
        id: id(),
        mapId: c.activeMapId,
        ownerId,
        name: p.name,
        assetId: p.assetId,
        ...(p.backAssetId ? { backAssetId: p.backAssetId } : {}),
        ...(p.appearance ? { appearance: p.appearance } : {}),
        x: Math.min(320, placeOn.width / 2),
        y: Math.min(320, placeOn.height / 2),
        size: p.size ?? 1,
        rotation: p.rotation ?? 0,
        status: p.status ?? "",
        hidden: m.role === "gm" ? Boolean(p.hidden) : false,
        z: c.tokens.length,
        sheet: p.sheet ?? defaultSheet(),
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
          appearance: appearance.optional(),
          backAssetId: key.nullable().optional(),
          flipped: z.boolean().optional(),
        })
        .parse(input);
      const t = token(p.id);
      if (p.hidden !== undefined || p.ownerId !== undefined) gm();
      if (p.ownerId && !c.members.some((m) => m.userId === p.ownerId))
        throw new Error("Unknown owner");
      if (p.assetId && p.assetId !== t.assetId) asset(p.assetId);
      if (p.backAssetId && p.backAssetId !== t.backAssetId) asset(p.backAssetId);
      const { assetId, backAssetId, ...updates } = p;
      Object.assign(t, updates);
      if (assetId === null) delete t.assetId;
      else if (assetId !== undefined) t.assetId = assetId;
      if (backAssetId === null) delete t.backAssetId;
      else if (backAssetId !== undefined) t.backAssetId = backAssetId;
      break;
    }
    case "token:flip": {
      // Show the other side of the token. With no back image the same picture is shown on both sides.
      const p = z.object({ id: key }).parse(input);
      const t = token(p.id);
      t.flipped = !t.flipped;
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
          character: characterSchema.nullable().optional(),
        })
        .parse(input);
      if (p.portrait) asset(p.portrait);
      p.art?.forEach(asset);
      const { character, ...rest } = p;
      Object.assign(m, rest);
      if (character === null) delete m.character; // player removed their character sheet
      else if (character) {
        m.character = character;
        applyCharacterToTokens(c, m);
      }
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
    case "asset:delete": {
      // Library clean-up: token images and character art only. Scenes are managed with Manage scenes.
      const p = z.object({ assetId: key }).parse(input);
      const a = asset(p.assetId);
      if (a.kind !== "token" && a.kind !== "art")
        throw new Error("Only token and character images can be deleted here");
      c.assets = c.assets.filter((x) => x.id !== a.id);
      // Tokens already on a map keep their place but fall back to a plain marker.
      for (const t of c.tokens) {
        if (t.assetId === a.id) delete t.assetId;
        if (t.backAssetId === a.id) delete t.backAssetId;
      }
      for (const mem of c.members) {
        if (mem.portrait === a.id) delete mem.portrait;
        mem.art = mem.art.filter((x) => x !== a.id);
      }
      break;
    }
    case "member:leave": {
      // A player permanently leaves the table. Their tokens go to the GM.
      if (m.role === "gm" && c.members.filter((x) => x.role === "gm").length < 2)
        throw new Error("The GM cannot leave their own table");
      removeMember(c, m.userId);
      break;
    }
    case "member:remove": {
      gm();
      const p = z.object({ userId: key }).parse(input);
      const target = c.members.find((x) => x.userId === p.userId);
      if (!target) throw new Error("That player is not at this table");
      if (target.role === "gm") throw new Error("A GM cannot be removed");
      removeMember(c, target.userId);
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
      // Accepts a bare pool ({ability: 2}) or { pool, label?, secret? }. Secret rolls are GM-only and hidden from players.
      const raw =
        input && typeof input === "object" && "pool" in input ? input : { pool: input };
      const p = z
        .object({
          pool: z.record(z.string(), num.int().min(0).max(30)),
          label: z.string().trim().max(60).optional(),
          secret: z.boolean().optional(),
        })
        .parse(raw);
      if (p.secret) gm();
      const roll = rollPool(p.pool, randomInt);
      c.messages.push({
        id: id(),
        userId,
        name: m.name,
        text: p.label ? `rolled ${p.label}` : "rolled a dice pool",
        time: Date.now(),
        roll,
        ...(p.label ? { label: p.label } : {}),
        ...(p.secret ? { to: userId, secret: true } : {}),
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
          name: z.string().trim().max(40).optional(),
          tokenId: key.optional(),
          hidden: z.boolean().optional(),
        })
        .parse(input);
      if (p.tokenId && !c.tokens.some((t) => t.id === p.tokenId))
        throw new Error("Unknown token");
      c.initiative.slots.push({ ...p, id: id(), used: false });
      c.initiative.slots.sort(
        (a, b) =>
          b.success - a.success ||
          b.advantage - a.advantage ||
          (a.type === "PC" ? -1 : 1),
      );
      break;
    }
    case "initiative:update": {
      gm();
      const p = z
        .object({
          id: key,
          hidden: z.boolean().optional(),
          name: z.string().trim().max(40).optional(),
        })
        .parse(input);
      const slot = c.initiative.slots.find((s) => s.id === p.id);
      if (!slot) throw new Error("Unknown slot");
      if (p.hidden !== undefined) slot.hidden = p.hidden;
      if (p.name !== undefined) {
        if (p.name) slot.name = p.name;
        else delete slot.name;
      }
      break;
    }
    case "initiative:remove": {
      gm();
      const p = z.object({ id: key }).parse(input);
      if (!c.initiative.slots.some((s) => s.id === p.id)) throw new Error("Unknown slot");
      c.initiative.slots = c.initiative.slots.filter((s) => s.id !== p.id);
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
  "token:flip",
  "token:delete",
  "token:duplicate",
  "token:layer",
  "profile:update",
  "profile:tree",
  "asset:delete",
  "member:leave",
  "member:remove",
  "handout:show",
  "handout:close",
  "dice:roll",
  "destiny:flip",
  "destiny:set",
  "initiative:add",
  "initiative:update",
  "initiative:remove",
  "initiative:use",
  "initiative:next",
  "initiative:clear",
  "chat:send",
];
