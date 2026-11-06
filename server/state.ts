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
  if (gm) return structuredClone(c);
  const tokens = c.tokens.filter(
    (t) =>
      t.mapId === c.activeMapId &&
      !t.hidden &&
      !obscured(
        c.maps.find((m) => m.id === t.mapId)!,
        t,
      ),
  );
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
  };
}
