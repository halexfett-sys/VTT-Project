import test from "node:test";
import assert from "node:assert/strict";
import { act } from "../server/actions";
import { newCampaign, viewFor, id } from "../server/state";
const fixture = () => {
  const gm = id(),
    player = id(),
    other = id(),
    c = newCampaign("Test", gm, "GM");
  c.members.push(
    {
      userId: player,
      name: "Player",
      color: "#ffffff",
      role: "player",
      art: [],
    },
    { userId: other, name: "Other", color: "#ffffff", role: "player", art: [] },
  );
  return { gm, player, other, c };
};
test("whispers never reach unrelated players", () => {
  const { c, gm, player, other } = fixture();
  act(c, gm, "chat:send", { text: "Secret", to: player });
  assert.equal(viewFor(c, player).messages.length, 1);
  assert.equal(viewFor(c, other).messages.length, 0);
  assert.throws(
    () => act(c, player, "chat:send", { text: "Secret", to: other }),
    /GM/,
  );
});
test("fog signature changes on hide and clear without exposing stroke coordinates", () => {
  const { c, gm, player } = fixture();
  const before = viewFor(c, player).maps[0].fogRevision;
  act(c, gm, "fog:stroke", {
    erase: false,
    size: 100,
    points: [{ x: 20, y: 20 }],
  });
  const masked = viewFor(c, player).maps[0];
  assert.notEqual(masked.fogRevision, before);
  assert.deepEqual(masked.fog, []);
  act(c, gm, "fog:clear", {});
  assert.equal(viewFor(c, player).maps[0].fogRevision, before);
});
test("flat-top hex snapping agrees with rendered centers", () => {
  const { c, gm } = fixture();
  act(c, gm, "map:grid", {
    type: "hex",
    size: 100,
    offsetX: 10,
    offsetY: 20,
    color: "#ffffff",
    snap: true,
  });
  act(c, gm, "token:create", { name: "Pilot" });
  const t = c.tokens[0];
  act(c, gm, "token:move", { id: t.id, x: 87, y: 65 });
  assert.equal(t.x, 85);
  assert.ok(Math.abs(t.y - (20 + Math.sqrt(3) * 25)) < 0.001);
});
test("special token permissions and private sheets", () => {
  const { c, gm, player, other } = fixture();
  act(c, player, "token:create", { name: "Pilot", ownerId: other });
  const t = c.tokens[0];
  assert.equal(t.ownerId, player);
  act(c, player, "token:update", {
    id: t.id,
    sheet: { ...t.sheet, notes: "private", credits: 500 },
  });
  assert.equal(viewFor(c, other).tokens[0].sheet.notes, "");
  assert.equal(viewFor(c, player).tokens[0].sheet.notes, "private");
  assert.throws(
    () => act(c, other, "token:delete", { id: t.id }),
    /permission/,
  );
  act(c, gm, "token:update", { id: t.id, hidden: true });
  assert.equal(viewFor(c, player).tokens.length, 0);
});
test("players cannot edit maps, fog, NPC slots, destiny totals or push handouts", () => {
  const { c, gm, player } = fixture();
  for (const event of [
    "map:create",
    "fog:clear",
    "destiny:set",
    "handout:show",
    "initiative:add",
  ])
    assert.throws(() => act(c, player, event, {}), /GM/);
  act(c, gm, "initiative:add", { type: "NPC", success: 1, advantage: 1 });
  assert.throws(
    () => act(c, player, "initiative:use", { id: c.initiative.slots[0].id }),
    /GM/,
  );
});

test("inactive scene tokens stay out of player snapshots", () => {
  const { c, gm, player } = fixture();
  act(c, gm, "token:create", { name: "Future encounter" });
  act(c, gm, "map:create", { name: "Current scene" });
  assert.equal(viewFor(c, player).tokens.length, 0);
  assert.equal(viewFor(c, gm).tokens.length, 1);
});

test("scene deletion is GM-only and validates the complete selection before mutation", () => {
  const { c, gm, player } = fixture(),
    original = c.maps[0].id;
  assert.throws(() => act(c, player, "map:delete", { ids: [original] }), /GM/);
  assert.throws(() => act(c, gm, "map:delete", { ids: [] }));
  assert.throws(
    () => act(c, gm, "map:delete", { ids: [original, id()] }),
    /no longer exists/,
  );
  assert.equal(c.maps[0].id, original);
});
test("deleting selected scenes removes their tokens and switches the active map", () => {
  const { c, gm } = fixture(),
    first = c.maps[0].id;
  act(c, gm, "token:create", { name: "Keep" });
  act(c, gm, "map:create", { name: "Delete" });
  const second = c.activeMapId;
  act(c, gm, "token:create", { name: "Remove" });
  act(c, gm, "map:delete", { ids: [second] });
  assert.equal(c.activeMapId, first);
  assert.deepEqual(
    c.tokens.map((t) => t.name),
    ["Keep"],
  );
  assert.deepEqual(
    c.maps.map((m) => m.id),
    [first],
  );
});
test("deleting inactive scenes preserves the active scene and reusable assets", () => {
  const { c, gm } = fixture(),
    first = c.maps[0].id;
  act(c, gm, "map:create", { name: "Keep active" });
  const active = c.activeMapId;
  c.assets.push({
    id: id(),
    ownerId: gm,
    kind: "map",
    name: "Reusable",
    width: 100,
    height: 100,
  });
  act(c, gm, "map:delete", { ids: [first] });
  assert.equal(c.activeMapId, active);
  assert.equal(c.assets.length, 1);
});
test("deleting all scenes creates a valid replacement and clears placed tokens", () => {
  const { c, gm, player } = fixture();
  act(c, gm, "token:create", { name: "Remove" });
  const original = c.activeMapId;
  act(c, gm, "map:delete", { ids: [original, original] });
  assert.equal(c.maps.length, 1);
  assert.notEqual(c.activeMapId, original);
  assert.equal(c.activeMapId, c.maps[0].id);
  assert.deepEqual(c.tokens, []);
  assert.equal(viewFor(c, player).maps[0].id, c.activeMapId);
});

test("owners can upload, replace, remove and share token appearance", () => {
  const { c, gm, player, other } = fixture();
  act(c, player, "token:create", { name: "Pilot" });
  const t = c.tokens[0];
  const a = {
    id: id(),
    ownerId: player,
    kind: "token" as const,
    name: "Portrait",
    width: 200,
    height: 100,
  };
  c.assets.push(a);
  const appearance = {
    background: "#112233",
    textColor: "#ffffff",
    outlineColor: "#ff0000",
    outlineWidth: 6,
    shape: "square",
    imageFit: "contain",
  };
  act(c, player, "token:update", { id: t.id, assetId: a.id, appearance });
  assert.equal(t.assetId, a.id);
  assert.deepEqual(t.appearance, appearance);
  assert.deepEqual(viewFor(c, other).tokens[0].appearance, appearance);
  assert.throws(
    () => act(c, other, "token:update", { id: t.id, appearance }),
    /permission/,
  );
  act(c, gm, "token:duplicate", { id: t.id });
  assert.deepEqual(c.tokens[1].appearance, appearance);
  act(c, player, "token:update", { id: t.id, assetId: null });
  assert.equal(t.assetId, undefined);
  assert.equal(c.assets.length, 1);
});
test("token appearance rejects invalid colors, sizes and unauthorized image references", () => {
  const { c, gm, player } = fixture();
  act(c, player, "token:create", { name: "Pilot" });
  const t = c.tokens[0],
    asset = {
      id: id(),
      ownerId: gm,
      kind: "token" as const,
      name: "GM image",
      width: 100,
      height: 100,
    };
  c.assets.push(asset);
  assert.throws(
    () => act(c, player, "token:update", { id: t.id, assetId: asset.id }),
    /Asset permission/,
  );
  const appearance = {
    background: "#112233",
    textColor: "#ffffff",
    outlineColor: "#ff0000",
    outlineWidth: 2,
    shape: "circle",
    imageFit: "cover",
  };
  for (const patch of [
    { background: "url(bad)" },
    { outlineWidth: 13 },
    { outlineWidth: -1 },
    { shape: "triangle" },
    { imageFit: "stretch" },
  ])
    assert.throws(() =>
      act(c, player, "token:update", {
        id: t.id,
        appearance: { ...appearance, ...patch },
      }),
    );
  assert.equal(t.appearance, undefined);
  act(c, gm, "token:update", { id: t.id, assetId: asset.id });
  act(c, player, "token:update", { id: t.id, assetId: asset.id, appearance });
  assert.deepEqual(t.appearance, appearance);
});
