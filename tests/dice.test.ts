import test from "node:test";
import assert from "node:assert/strict";
import { dice, resolve, rollPool } from "../shared/dice";
test("all seven dice have correct face counts", () =>
  assert.deepEqual(
    Object.values(dice).map((v) => v.length),
    [6, 6, 8, 8, 12, 12, 12],
  ));
test("success and advantage cancel independently; triumph/despair persist", () => {
  const r = resolve([
    dice.proficiency[11],
    dice.challenge[11],
    dice.boost[3],
    dice.difficulty[6],
  ]);
  assert.equal(r.success, 1);
  assert.equal(r.threat, 1);
  assert.equal(r.triumph, 1);
  assert.equal(r.despair, 1);
});
test("force pips never cancel", () => {
  const r = resolve([dice.force[6], dice.force[11]]);
  assert.equal(r.dark, 2);
  assert.equal(r.light, 2);
});
test("deterministic rolls use supplied entropy", () => {
  assert.equal(rollPool({ ability: 2 }, () => 3).net.success, 4);
});
test("invalid and excessive pools are rejected", () => {
  for (const pool of [
    { ability: -1 },
    { ability: 1.5 },
    { nope: 1 },
    { ability: 30, boost: 30, force: 1 },
    {},
  ])
    assert.throws(() => rollPool(pool as any, () => 0));
});
test("face distribution totals are stable", () => {
  const totals = (d: keyof typeof dice, k: string) =>
    dice[d].reduce((n, f) => n + (f as any)[k], 0);
  assert.equal(totals("proficiency", "success"), 10);
  assert.equal(totals("challenge", "failure"), 9);
  assert.equal(totals("force", "dark"), 8);
  assert.equal(totals("force", "light"), 8);
});
