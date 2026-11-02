import type { Die, Pool, Roll, Symbols } from "./types";
const zero = (): Symbols => ({
  success: 0,
  failure: 0,
  advantage: 0,
  threat: 0,
  triumph: 0,
  despair: 0,
  light: 0,
  dark: 0,
});
const face = (s: Partial<Symbols>): Symbols => ({ ...zero(), ...s });
// Numeric face tables only; no proprietary symbol artwork or rules prose.
export const dice: Record<Die, Symbols[]> = {
  boost: [
    {},
    {},
    { success: 1 },
    { success: 1, advantage: 1 },
    { advantage: 2 },
    { advantage: 1 },
  ].map(face),
  setback: [
    {},
    {},
    { failure: 1 },
    { failure: 1 },
    { threat: 1 },
    { threat: 1 },
  ].map(face),
  ability: [
    {},
    { success: 1 },
    { success: 1 },
    { success: 2 },
    { advantage: 1 },
    { advantage: 1 },
    { success: 1, advantage: 1 },
    { advantage: 2 },
  ].map(face),
  difficulty: [
    {},
    { failure: 1 },
    { failure: 2 },
    { threat: 1 },
    { threat: 1 },
    { threat: 1 },
    { threat: 2 },
    { failure: 1, threat: 1 },
  ].map(face),
  proficiency: [
    {},
    { success: 1 },
    { success: 1 },
    { success: 2 },
    { success: 2 },
    { advantage: 1 },
    { success: 1, advantage: 1 },
    { success: 1, advantage: 1 },
    { success: 1, advantage: 1 },
    { advantage: 2 },
    { advantage: 2 },
    { triumph: 1, success: 1 },
  ].map(face),
  challenge: [
    {},
    { failure: 1 },
    { failure: 1 },
    { failure: 2 },
    { failure: 2 },
    { threat: 1 },
    { threat: 1 },
    { failure: 1, threat: 1 },
    { failure: 1, threat: 1 },
    { threat: 2 },
    { threat: 2 },
    { despair: 1, failure: 1 },
  ].map(face),
  force: [
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 1 },
    { dark: 2 },
    { light: 1 },
    { light: 1 },
    { light: 2 },
    { light: 2 },
    { light: 2 },
  ].map(face),
};
export function resolve(symbols: Symbols[]): Symbols {
  const sum = zero();
  for (const s of symbols)
    for (const k of Object.keys(sum) as (keyof Symbols)[]) sum[k] += s[k];
  const success = sum.success - sum.failure,
    advantage = sum.advantage - sum.threat;
  return {
    ...sum,
    success: Math.max(0, success),
    failure: Math.max(0, -success),
    advantage: Math.max(0, advantage),
    threat: Math.max(0, -advantage),
  };
}
export function rollPool(
  pool: Pool,
  randomIndex: (max: number) => number,
): Roll {
  let count = 0;
  const faces: Roll["faces"] = [];
  for (const [key, n] of Object.entries(pool)) {
    if (!(key in dice) || !Number.isInteger(n) || n < 0 || n > 30)
      throw new Error("Invalid dice pool");
    count += n;
    if (count > 60) throw new Error("Maximum 60 dice");
    const die = key as Die;
    for (let i = 0; i < n; i++) {
      const index = randomIndex(dice[die].length);
      faces.push({ die, face: index, symbols: dice[die][index] });
    }
  }
  if (!count) throw new Error("Add at least one die");
  return { faces, net: resolve(faces.map((f) => f.symbols)) };
}
