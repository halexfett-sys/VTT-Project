import test from "node:test";
import { emptyCharacter } from "../shared/character";
import assert from "node:assert/strict";
import { act } from "../server/actions";
import { newCampaign, viewFor, id } from "../server/state";
const fixture = () => {
  const gm = id(),
    player = id(),
    other = id(),
    c = newCampaign("Test", gm, "GM");
  c.members.push(
    { userId: player, name: "Player", color: "#ff0000", role: "player", art: [] },
    { userId: other, name: "Other", color: "#00ff00", role: "player", art: [] },
  );
  return { gm, player, other, c };
};
const appearance = {
  background: "#112233",
  textColor: "#ffffff",
  outlineColor: "#ff00ff",
  outlineWidth: 4,
  shape: "square",
  imageFit: "cover",
};
test("tokens keep their look and position when the scene changes", () => {
  const { c, gm, player, other } = fixture();
  act(c, player, "token:create", { name: "Hero", appearance });
  const t = c.tokens[0];
  act(c, player, "token:move", { id: t.id, x: 200, y: 300 });
  const before = structuredClone(c.tokens[0]);
  act(c, gm, "map:create", { name: "Second scene" });
  for (const who of [gm, player, other]) {
    const seen = viewFor(c, who).tokens.find((x) => x.id === t.id)!;
    assert.ok(seen, "token is still on the table after the switch");
    assert.equal(seen.x, before.x);
    assert.equal(seen.y, before.y);
    assert.deepEqual(seen.appearance, before.appearance);
  }
  act(c, gm, "map:activate", { id: c.maps[0].id });
  assert.equal(viewFor(c, other).tokens.length, 1);
});
test("tokens survive deleting the scene they were placed on", () => {
  const { c, gm, player } = fixture();
  const first = c.maps[0].id;
  act(c, player, "token:create", { name: "Hero" });
  act(c, gm, "map:create", { name: "Second scene" });
  act(c, gm, "map:delete", { ids: [first] });
  assert.equal(c.tokens.length, 1);
  assert.ok(c.maps.some((m) => m.id === c.tokens[0].mapId));
});
test("range bands set down are shared, and only owner or GM can remove them", () => {
  const { c, gm, player, other } = fixture();
  act(c, player, "band:add", { x: 100, y: 120, base: 64, color: "#ff5a5f" });
  const seen = viewFor(c, other).bands!;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].x, 100);
  assert.equal(seen[0].color, "#ff5a5f");
  assert.throws(() => act(c, other, "band:remove", { id: seen[0].id }), /owner/);
  act(c, gm, "band:remove", { id: seen[0].id });
  assert.equal(viewFor(c, player).bands!.length, 0);
});
test("clearing bands: players clear their own, only the GM clears all", () => {
  const { c, gm, player, other } = fixture();
  act(c, player, "band:add", { x: 1, y: 1, base: 64, color: "#ffffff" });
  act(c, other, "band:add", { x: 2, y: 2, base: 64, color: "#ffffff" });
  act(c, player, "band:clear", {});
  assert.deepEqual(c.bands!.map((b) => b.ownerId), [other]);
  assert.throws(() => act(c, player, "band:clear", { all: true }), /GM/);
  act(c, gm, "band:clear", { all: true });
  assert.equal(c.bands!.length, 0);
});
test("range bands stay with their scene", () => {
  const { c, gm, player } = fixture();
  act(c, gm, "band:add", { x: 5, y: 5, base: 64, color: "#ffffff" });
  act(c, gm, "map:create", { name: "Second scene" });
  assert.equal(viewFor(c, player).bands!.length, 0);
  act(c, gm, "map:activate", { id: c.maps[0].id });
  assert.equal(viewFor(c, player).bands!.length, 1);
});
test("pings reach everyone in the scene, use the sender's colour, and are rate limited", () => {
  const { c, player, other } = fixture();
  act(c, player, "ping:add", { x: 400, y: 250 });
  act(c, player, "ping:add", { x: 10, y: 10 }); // too soon after the first
  const seen = viewFor(c, other).pings!;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].x, 400);
  assert.equal(seen[0].color, "#ff0000");
  assert.throws(() => act(c, player, "ping:add", { x: -5, y: 10 }));
});
test("old pings are pruned on the next action", () => {
  const { c, gm, player } = fixture();
  act(c, player, "ping:add", { x: 1, y: 1 });
  c.pings![0].time -= 60_000;
  act(c, gm, "chat:send", { text: "hello" });
  assert.equal(c.pings!.length, 0);
});
test("a new range band replaces the placer's previous one", () => {
  const { c, gm, player } = fixture();
  act(c, player, "band:add", { x: 1, y: 1, base: 64, color: "#ffffff" });
  act(c, gm, "band:add", { x: 2, y: 2, base: 64, color: "#ffffff" });
  act(c, player, "band:add", { x: 3, y: 3, base: 64, color: "#ff0000" });
  assert.equal(c.bands!.length, 2);
  assert.deepEqual(c.bands!.filter((b) => b.ownerId === player).map((b) => b.x), [3]);
});
test("D100 rolls land in the log, secret ones stay GM-only", () => {
  const { c, gm, player, other } = fixture();
  act(c, player, "dice:d100", { label: "Percentile" });
  const roll = c.messages.at(-1)!;
  assert.ok(roll.d100! >= 1 && roll.d100! <= 100);
  assert.equal(viewFor(c, other).messages.at(-1)!.d100, roll.d100);
  assert.throws(() => act(c, player, "dice:d100", { secret: true }), /GM/);
  act(c, gm, "dice:d100", { secret: true });
  assert.equal(viewFor(c, player).messages.filter((m) => m.d100 !== undefined).length, 1);
});
test("only the GM clears chat or the roll log, and each clears only its own kind", () => {
  const { c, gm, player } = fixture();
  act(c, player, "chat:send", { text: "hello" });
  act(c, player, "dice:roll", { ability: 2 });
  act(c, player, "dice:d100", {});
  assert.throws(() => act(c, player, "chat:clear", { scope: "chat" }), /GM/);
  act(c, gm, "chat:clear", { scope: "chat" });
  assert.deepEqual(c.messages.map((m) => Boolean(m.roll) || m.d100 !== undefined), [true, true]);
  act(c, gm, "chat:clear", { scope: "rolls" });
  assert.equal(c.messages.length, 0);
});
test("GM can drag initiative slots; added combatants slot in without undoing the order", () => {
  const { c, gm, player } = fixture();
  for (const [type, success, name] of [["PC", 5, "A"], ["NPC", 4, "B"], ["PC", 3, "C"]] as const)
    act(c, gm, "initiative:add", { type, success, advantage: 0, name });
  const [a, b, cc] = c.initiative.slots.map((s) => s.id);
  assert.throws(() => act(c, player, "initiative:move", { id: a }), /GM/);
  act(c, gm, "initiative:move", { id: cc, before: a });
  assert.deepEqual(c.initiative.slots.map((s) => s.name), ["C", "A", "B"]);
  act(c, gm, "initiative:move", { id: cc });
  assert.deepEqual(c.initiative.slots.map((s) => s.name), ["A", "B", "C"]);
  act(c, gm, "initiative:move", { id: b, before: a });
  act(c, gm, "initiative:add", { type: "NPC", success: 1, advantage: 0, name: "D" });
  assert.deepEqual(c.initiative.slots.map((s) => s.name), ["B", "A", "C", "D"]);
});
test("a token created after the sheet was imported gets the character's thresholds, soak and defense", () => {
  const { c, player } = fixture();
  const sheetChar = { ...emptyCharacter(), name: "Kira", soak: 5, woundThreshold: 16, strainThreshold: 14, defenseMelee: 1 };
  act(c, player, "profile:update", { character: sheetChar });
  act(c, player, "token:create", { name: "Kira" });
  const t = c.tokens[0];
  assert.equal(t.sheet.soak, 5);
  assert.equal(t.sheet.woundThreshold, 16);
  assert.equal(t.sheet.strainThreshold, 14);
  assert.equal(t.sheet.defense, 1);
  act(c, player, "token:create", { name: "Companion" });
  assert.equal(c.tokens[1].sheet.woundThreshold, 12, "unrelated second token is left alone");
});
