import {
  charCodes,
  characterSchema,
  emptyCharacter,
  findSkill,
  type CharKey,
  type CharSkill,
  type Character,
} from "./character.js";

/** Minimal XML tree (elements + text) so the importer works in browsers and Node without a DOM. */
type XNode = { name: string; text: string; kids: XNode[] };
const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return entities[e.toLowerCase()] ?? m;
  });

export function parseXml(src: string): XNode {
  const root: XNode = { name: "#root", text: "", kids: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[3]) {
      if (m[2]) {
        if (stack.length > 1) stack.pop(); // tolerate stray closing tags
      } else {
        const n: XNode = { name: m[3], text: "", kids: [] };
        top.kids.push(n);
        if (!m[5]) stack.push(n);
      }
    } else if (m[6] !== undefined) top.text += decode(m[6]);
  }
  const doc = root.kids[0];
  if (!doc) throw new Error("This file is not valid XML");
  return doc;
}

const lc = (s: string) => s.toLowerCase();
const first = (n: XNode, name: string) => n.kids.find((k) => lc(k.name) === lc(name));
const all = (n: XNode, name: string): XNode[] => [
  ...n.kids.filter((k) => lc(k.name) === lc(name)),
  ...n.kids.flatMap((k) => all(k, name)),
];
const text = (n?: XNode) => n?.text.trim() ?? "";
const num = (s: string) => {
  const v = Number(s.trim());
  return s.trim() !== "" && Number.isFinite(v) ? v : undefined;
};
const firstText = (n: XNode, ...names: string[]) => {
  for (const name of names) {
    const v = text(all(n, name)[0]);
    if (v) return v;
  }
  return "";
};
const firstNum = (n: XNode, ...names: string[]) => num(firstText(n, ...names));

/** Total ranks for an OggDude Rank block: TotalRanks if present, otherwise the sum of its numeric parts.
 *  NonCareerRanks only records how many of the purchased ranks were bought at the non-career price, so it is not added again. */
function totalRanks(n: XNode): number {
  const r = first(n, "Rank");
  if (!r) return num(text(first(n, "Ranks"))) ?? 0;
  if (!r.kids.length) return num(r.text) ?? 0;
  const tot = r.kids.find((k) => /^total(ranks?)?$/i.test(k.name));
  if (tot && num(text(tot)) !== undefined) return num(text(tot))!;
  return r.kids.reduce((sum, k) => sum + (/^non-?career/i.test(k.name) ? 0 : (num(text(k)) ?? 0)), 0);
}

/** "BOUNTYHUNTER" -> "Bounty Hunter" style fallback when the file only has an identifier. */
export function prettyKey(k: string) {
  if (!k) return "";
  if (/[a-z]/.test(k) && /\s/.test(k)) return k;
  return k
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
const nameOrKey = (n: XNode | undefined, keyName: string, nameName: string) =>
  n ? prettyKey(text(first(n, nameName)) || text(first(n, keyName))) : "";

export type ImportResult = { character: Character; warnings: string[] };

export function importOggDude(xml: string): ImportResult {
  const doc = parseXml(xml);
  if (lc(doc.name) !== "character")
    throw new Error("This does not look like an OggDude character file");
  const warnings: string[] = [];
  const c = emptyCharacter();

  c.name = firstText(doc, "CharName") || undefined;
  const species = first(doc, "Species");
  c.species = nameOrKey(species, "SpeciesKey", "SpeciesName") || undefined;
  const career = first(doc, "Career");
  c.career = nameOrKey(career, "CareerKey", "CareerName") || undefined;

  const specs = new Set<string>();
  if (career) {
    for (const s of all(career, "CharSpecialization"))
      specs.add(nameOrKey(s, "Key", "Name"));
    for (const s of all(career, "SpecializationKey")) specs.add(prettyKey(text(s)));
    const holder = first(career, "Specializations");
    if (holder && !specs.size)
      for (const k of holder.kids) {
        const v = text(first(k, "Key")) || text(k);
        if (v) specs.add(prettyKey(v));
      }
  }
  c.specializations = [...specs].filter(Boolean).slice(0, 20);

  const credits = firstNum(doc, "Credits");
  if (credits !== undefined) c.credits = Math.max(0, Math.round(credits));

  let chars = 0;
  for (const ch of all(doc, "CharCharacteristic")) {
    const code = text(first(ch, "Key")).toUpperCase();
    const key: CharKey | undefined = charCodes[code];
    if (!key) continue;
    c.characteristics[key] = Math.min(10, Math.max(0, totalRanks(ch)));
    chars++;
  }
  if (chars < 6) warnings.push("Some characteristics were not found; check them below.");

  const careerSkills = new Set<string>();
  for (const k of [
    ...(career ? all(career, "CareerSkills") : []),
    ...(career ? all(career, "Skills") : []),
  ])
    for (const s of all(k, "Key")) careerSkills.add(text(s).toUpperCase());
  const skills: CharSkill[] = [];
  const unknown: string[] = [];
  for (const sk of all(doc, "CharSkill")) {
    const key = text(first(sk, "Key"));
    if (!key) continue;
    const def = findSkill(key);
    const rank = Math.min(10, Math.max(0, totalRanks(sk)));
    const isCareer =
      /^(true|1)$/i.test(text(first(sk, "IsCareer"))) ||
      careerSkills.has(key.toUpperCase());
    if (!def) unknown.push(key);
    skills.push({
      key: def?.key ?? key.slice(0, 40),
      name: def?.name ?? prettyKey(key).slice(0, 60),
      characteristic: def?.characteristic ?? "intellect",
      rank,
      career: isCareer,
    });
  }
  c.skills = skills;
  if (!skills.length) warnings.push("No skills were found in this file.");
  if (unknown.length)
    warnings.push(
      `Unrecognised skills were added with Intellect as the characteristic: ${unknown.join(", ")}.`,
    );

  const derived = {
    soak: firstNum(doc, "Soak", "SoakValue", "TotalSoak"),
    woundThreshold: firstNum(doc, "WoundThreshold", "Wounds"),
    strainThreshold: firstNum(doc, "StrainThreshold", "Strain"),
    defenseRanged: firstNum(doc, "DefenseRanged", "RangedDefense", "DefRanged"),
    defenseMelee: firstNum(doc, "DefenseMelee", "MeleeDefense", "DefMelee"),
  };
  const missing: string[] = [];
  for (const [k, v] of Object.entries(derived)) {
    if (v === undefined) missing.push(k);
    else (c as Record<string, unknown>)[k] = Math.max(0, Math.min(99, Math.round(v)));
  }
  if (derived.soak === undefined) c.soak = c.characteristics.brawn; // soak is at least Brawn
  if (missing.length)
    warnings.push(
      "Soak, wound/strain thresholds and defense are not always stored in the file; fill in any that are zero.",
    );

  return { character: characterSchema.parse(c), warnings };
}
