import { randomUUID } from "node:crypto";
import type { Campaign, MapScene, Point, Token } from "../shared/types.js";
export const id = () => randomUUID();
export function newMap(name = "Uncharted landing zone"): MapScene {
  return {
    id: id(),
    name,
    width: 1600,
    height: 1000,
    grid: {
      type: "square",
      size: 64,
      offsetX: 0,
      offsetY: 0,
      color: "#607d8b",
      snap: true,
    },
    fog: [],
  };
}
export function newCampaign(
  name: string,
  userId: string,
  username: string,
): Campaign {
  const map = newMap();
  return {
    id: id(),
    name,
    invite: randomUUID().replaceAll("-", ""),
    revision: 0,
    activeMapId: map.id,
    maps: [map],
    tokens: [],
    assets: [],
    members: [
      { userId, name: username, color: "#e9b56b", role: "gm", art: [] },
    ],
    messages: [],
    destiny: { light: 2, dark: 2 },
    initiative: { round: 1, slots: [] },
  };
}
function distance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function obscured(map: MapScene, p: Point) {
  let hidden = false;
  for (const stroke of map.fog) {
    if (
      stroke.points.some(
        (a, i) =>
          distance(p, a, stroke.points[Math.max(0, i - 1)]) <= stroke.size / 2,
      )
    )
      hidden = !stroke.erase;
  }
  return hidden;
}
export function canEdit(c: Campaign, userId: string, t: Token) {
  return c.members.some(
    (m) => m.userId === userId && (m.role === "gm" || t.ownerId === userId),
  );
}
export function viewFor(c: Campaign, userId: string): Campaign {
  const gm = c.members.some((m) => m.userId === userId && m.role === "gm");
  // Personal notes belong to their writer alone, GM included.
  const mine = (members: Campaign["members"]) =>
    members.map((m) => (m.userId === userId ? m : { ...m, notes: undefined }));
  if (gm) {
    const copy = structuredClone(c);
    copy.members = mine(copy.members);
    return copy;
  }
  // Tokens belong to the whole table, so they follow the table from scene to scene.
  // Fog is judged against the scene everyone is looking at.
  const active = c.maps.find((m) => m.id === c.activeMapId)!;
  const tokens = c.tokens.filter((t) => !t.hidden && !obscured(active, t));
  // A token's back image is only revealed to other players once the token has been flipped.
  const showBack = (t: Token) => Boolean(t.flipped) || t.ownerId === userId;
  const allowed = new Set([
    ...tokens.map((t) => t.assetId),
    ...tokens.filter(showBack).map((t) => t.backAssetId),
    ...c.members.flatMap((m) => [m.portrait, ...m.art]),
    c.handout?.assetId,
  ]);
  return {
    ...structuredClone(c),
    members: mine(structuredClone(c.members)),
    invite: "",
    initiative: {
      ...c.initiative,
      slots: c.initiative.slots.map((s) =>
        s.hidden || c.tokens.find((t) => t.id === s.tokenId)?.hidden
          ? { id: s.id, type: s.type, success: 0, advantage: 0, used: s.used, hidden: true }
          : s,
      ),
    },
    tokens: tokens.map((t) => ({
      ...t,
      backAssetId: showBack(t) ? t.backAssetId : undefined,
      sheet:
        t.ownerId === userId
          ? t.sheet
          : {
              wounds: 0,
              woundThreshold: 0,
              strain: 0,
              strainThreshold: 0,
              soak: 0,
              defense: 0,
              credits: 0,
              notes: "",
            },
    })),
    assets: c.assets.filter(
      (a) => (a.ownerId === userId && a.kind !== "map") || allowed.has(a.id),
    ),
    maps: c.maps
      .filter((m) => m.id === c.activeMapId)
      .map((m) => ({
        ...m,
        hasImage: Boolean(m.assetId),
        assetId: undefined,
        fog: [],
        fogRevision: m.fog.map((s) => s.id).join(","),
      })),
    messages: c.messages.filter(
      (m) => !m.to || m.to === userId || m.userId === userId,
    ),
    bands: (c.bands ?? []).filter((b) => b.mapId === c.activeMapId),
    pings: (c.pings ?? []).filter((p) => p.mapId === c.activeMapId),
  };
}

/**
 * Tokens belong to the whole table and always follow the active scene.
 * Older tables kept a separate copy of "the same" token on every scene; this folds those copies back into one.
 * A token counts as the same when owner, name and image match. The table keeps as many of it as its fullest scene
 * had, taking them from the `prefer` scene first (the scene the table is coming from, so tokens already on the table
 * stay exactly as they are) and dropping the extra copies. Several identical tokens inside one scene
 * (a squad of troopers) are deliberate and are left alone.
 * Every kept token ends up on the active scene. With `clampAll`, any token that would sit off the edge of that scene
 * is pulled back onto it; everything else keeps its exact position.
 */
export function reconcileTokens(
  c: Campaign,
  opts: { prefer?: string; clampAll?: boolean } = {},
) {
  const active = c.maps.find((m) => m.id === c.activeMapId);
  if (!active) return;
  const prefer = opts.prefer ?? active.id;
  const keyOf = (t: Token) => `${t.ownerId}|${t.name.trim().toLowerCase()}|${t.assetId ?? ""}`;
  const groups = new Map<string, Map<string, Token[]>>();
  for (const t of c.tokens) {
    const scenes = groups.get(keyOf(t)) ?? new Map<string, Token[]>();
    scenes.set(t.mapId, [...(scenes.get(t.mapId) ?? []), t]);
    groups.set(keyOf(t), scenes);
  }
  const keep = new Set<string>();
  for (const scenes of groups.values()) {
    const lists = [...scenes.entries()].sort(
      ([a, la], [b, lb]) => Number(b === prefer) - Number(a === prefer) || lb.length - la.length,
    );
    const need = Math.max(...lists.map(([, l]) => l.length));
    for (const t of lists.flatMap(([, l]) => l).slice(0, need)) keep.add(t.id);
  }
  const dropped = new Set(c.tokens.filter((t) => !keep.has(t.id)).map((t) => t.id));
  if (dropped.size) {
    c.tokens = c.tokens.filter((t) => keep.has(t.id));
    for (const slot of c.initiative.slots)
      if (slot.tokenId && dropped.has(slot.tokenId)) delete slot.tokenId;
  }
  for (const t of c.tokens) {
    const wasElsewhere = t.mapId !== active.id;
    t.mapId = active.id;
    if (opts.clampAll || wasElsewhere) {
      t.x = Math.max(0, Math.min(active.width, t.x));
      t.y = Math.max(0, Math.min(active.height, t.y));
    }
  }
}
