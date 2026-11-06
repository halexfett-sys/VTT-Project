import { z } from "zod";
import type { Pool } from "./types.js";

export const charKeys = [
  "brawn",
  "agility",
  "intellect",
  "cunning",
  "willpower",
  "presence",
] as const;
export type CharKey = (typeof charKeys)[number];
export const charLabels: Record<CharKey, string> = {
  brawn: "Brawn",
  agility: "Agility",
  intellect: "Intellect",
  cunning: "Cunning",
  willpower: "Willpower",
  presence: "Presence",
};

/** Two-letter OggDude characteristic codes. */
export const charCodes: Record<string, CharKey> = {
  BR: "brawn",
  AG: "agility",
  INT: "intellect",
  CUN: "cunning",
  WIL: "willpower",
  PR: "presence",
};

export type SkillGroup = "General" | "Combat" | "Knowledge";
export type SkillDef = {
  key: string;
  name: string;
  characteristic: CharKey;
  group: SkillGroup;
  aliases?: string[];
};

/** Core Edge / Age / Force and Destiny skill list. Keys follow OggDude's Skills data. */
export const skillDefs: SkillDef[] = [
  { key: "ASTRO", name: "Astrogation", characteristic: "intellect", group: "General" },
  { key: "ATHL", name: "Athletics", characteristic: "brawn", group: "General" },
  { key: "CHARM", name: "Charm", characteristic: "presence", group: "General" },
  { key: "COERC", name: "Coercion", characteristic: "willpower", group: "General" },
  { key: "COMP", name: "Computers", characteristic: "intellect", group: "General" },
  { key: "COOL", name: "Cool", characteristic: "presence", group: "General" },
  { key: "COORD", name: "Coordination", characteristic: "agility", group: "General" },
  { key: "DECEP", name: "Deception", characteristic: "cunning", group: "General", aliases: ["DECEIT"] },
  { key: "DISC", name: "Discipline", characteristic: "willpower", group: "General" },
  { key: "LEAD", name: "Leadership", characteristic: "presence", group: "General" },
  { key: "MECH", name: "Mechanics", characteristic: "intellect", group: "General" },
  { key: "MED", name: "Medicine", characteristic: "intellect", group: "General" },
  { key: "NEG", name: "Negotiation", characteristic: "presence", group: "General" },
  { key: "PERC", name: "Perception", characteristic: "cunning", group: "General" },
  { key: "PILOTPL", name: "Piloting (Planetary)", characteristic: "agility", group: "General" },
  { key: "PILOTSP", name: "Piloting (Space)", characteristic: "agility", group: "General" },
  { key: "RESIL", name: "Resilience", characteristic: "brawn", group: "General" },
  { key: "RIDE", name: "Riding", characteristic: "agility", group: "General" },
  { key: "SKUL", name: "Skulduggery", characteristic: "cunning", group: "General" },
  { key: "STEAL", name: "Stealth", characteristic: "agility", group: "General" },
  { key: "SURV", name: "Survival", characteristic: "cunning", group: "General" },
  { key: "VIGIL", name: "Vigilance", characteristic: "willpower", group: "General" },
  { key: "BRAWL", name: "Brawl", characteristic: "brawn", group: "Combat" },
  { key: "GUNN", name: "Gunnery", characteristic: "agility", group: "Combat" },
  { key: "LTSABER", name: "Lightsaber", characteristic: "brawn", group: "Combat", aliases: ["LIGHTSABER"] },
  { key: "MELEE", name: "Melee", characteristic: "brawn", group: "Combat" },
  { key: "RANGHVY", name: "Ranged (Heavy)", characteristic: "agility", group: "Combat", aliases: ["RANGEDHEAVY"] },
  { key: "RANGLT", name: "Ranged (Light)", characteristic: "agility", group: "Combat", aliases: ["RANGEDLIGHT"] },
  { key: "CORE", name: "Core Worlds", characteristic: "intellect", group: "Knowledge", aliases: ["COREWORLDS"] },
  { key: "EDU", name: "Education", characteristic: "intellect", group: "Knowledge", aliases: ["EDUC"] },
  { key: "LORE", name: "Lore", characteristic: "intellect", group: "Knowledge" },
  { key: "OUT", name: "Outer Rim", characteristic: "intellect", group: "Knowledge", aliases: ["OUTERRIM"] },
  { key: "UND", name: "Underworld", characteristic: "intellect", group: "Knowledge", aliases: ["UNDERWORLD"] },
  { key: "XEN", name: "Xenology", characteristic: "intellect", group: "Knowledge", aliases: ["XENOLOGY"] },
];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const byKey = new Map<string, SkillDef>();
for (const d of skillDefs) {
  byKey.set(norm(d.key), d);
  byKey.set(norm(d.name), d);
  d.aliases?.forEach((a) => byKey.set(norm(a), d));
}
/** Look a skill up by OggDude key or by display name. */
export function findSkill(keyOrName: string): SkillDef | undefined {
  return byKey.get(norm(keyOrName));
}

const rank = z.number().int().min(0).max(10);
const stat = z.number().int().min(0).max(99);
export const skillSchema = z.object({
  key: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(60),
  characteristic: z.enum(charKeys),
  rank: rank,
  career: z.boolean(),
});
export const characterSchema = z.object({
  name: z.string().trim().max(80).optional(),
  species: z.string().trim().max(80).optional(),
  career: z.string().trim().max(80).optional(),
  specializations: z.array(z.string().trim().max(80)).max(20),
  credits: z.number().int().min(0).max(1e12),
  characteristics: z.object({
    brawn: rank,
    agility: rank,
    intellect: rank,
    cunning: rank,
    willpower: rank,
    presence: rank,
  }),
  soak: stat,
  woundThreshold: stat,
  strainThreshold: stat,
  defenseRanged: stat,
  defenseMelee: stat,
  counterKind: z.enum(["Obligation", "Duty", "Morality"]),
  counter: z.number().int().min(1).max(100),
  skills: z.array(skillSchema).max(80),
});
export type CharSkill = z.infer<typeof skillSchema>;
export type Character = z.infer<typeof characterSchema>;

export const emptyCharacter = (): Character => ({
  specializations: [],
  credits: 0,
  characteristics: {
    brawn: 1,
    agility: 1,
    intellect: 1,
    cunning: 1,
    willpower: 1,
    presence: 1,
  },
  soak: 0,
  woundThreshold: 0,
  strainThreshold: 0,
  defenseRanged: 0,
  defenseMelee: 0,
  counterKind: "Obligation",
  counter: 50,
  skills: [],
});

/** A full skill list (rank 0) so every skill is always shown, merged with the character's own ranks. */
export function withAllSkills(c: Character): CharSkill[] {
  const have = new Map(c.skills.map((s) => [norm(s.key), s]));
  const out: CharSkill[] = skillDefs.map(
    (d) =>
      have.get(norm(d.key)) ?? {
        key: d.key,
        name: d.name,
        characteristic: d.characteristic,
        rank: 0,
        career: false,
      },
  );
  const known = new Set(skillDefs.map((d) => norm(d.key)));
  for (const s of c.skills) if (!known.has(norm(s.key))) out.push(s); // custom/unknown skills
  return out;
}

/** Ability + Proficiency dice for a skill check: higher of (characteristic, rank) are ability, lower are upgraded to proficiency. */
export function skillDice(c: Character, s: CharSkill) {
  const ch = c.characteristics[s.characteristic];
  const proficiency = Math.min(ch, s.rank);
  return { proficiency, ability: Math.max(ch, s.rank) - proficiency };
}

/** Replace only the ability/proficiency dice in a pool; boost, setback, difficulty, challenge and force are kept. */
export function applySkillToPool(pool: Pool, c: Character, s: CharSkill): Pool {
  const { ability, proficiency } = skillDice(c, s);
  const next: Pool = { ...pool };
  delete next.ability;
  delete next.proficiency;
  if (ability) next.ability = ability;
  if (proficiency) next.proficiency = proficiency;
  return next;
}
