import { findSpecializationTree } from "./trees.js";
import {
  charCodes,
  characterSchema,
  emptyCharacter,
  findSkill,
  retiredSkills,
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
const keyNorm = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** Proper display names for the identifiers OggDude uses, and the base wound/strain thresholds of species whose numbers are well known. */
const knownNames: Record<string, string> = {
  BOUNTYHUNTER: "Bounty Hunter", COLONIST: "Colonist", EXPLORER: "Explorer", HIREDGUN: "Hired Gun",
  SMUGGLER: "Smuggler", TECHNICIAN: "Technician", ACE: "Ace", COMMANDER: "Commander", DIPLOMAT: "Diplomat",
  ENGINEER: "Engineer", SOLDIER: "Soldier", SPY: "Spy", CONSULAR: "Consular", GUARDIAN: "Guardian",
  MYSTIC: "Mystic", SEEKER: "Seeker", SENTINEL: "Sentinel", WARRIOR: "Warrior",
  BOTHAN: "Bothan", DROID: "Droid", GAND: "Gand", HUMAN: "Human", RODIAN: "Rodian", TRANDOSHAN: "Trandoshan",
  TWILEK: "Twi'lek", WOOKIEE: "Wookiee", MONCALAMARI: "Mon Calamari", SULLUSTAN: "Sullustan", CEREAN: "Cerean",
  KELDOR: "Kel Dor", ZABRAK: "Zabrak", TOGRUTA: "Togruta", MIRIALAN: "Mirialan",
  // Short codes as they appear in real OggDude files.
  TWI: "Twi'lek", SMUG: "Smuggler",
};
const speciesBase: Record<string, { wounds: number; strain: number }> = {
  HUMAN: { wounds: 10, strain: 10 }, BOTHAN: { wounds: 10, strain: 11 }, DROID: { wounds: 10, strain: 10 },
  GAND: { wounds: 10, strain: 10 }, RODIAN: { wounds: 10, strain: 10 }, TRANDOSHAN: { wounds: 12, strain: 9 },
  TWILEK: { wounds: 10, strain: 11 }, TWI: { wounds: 10, strain: 11 }, WOOKIEE: { wounds: 14, strain: 8 },
};
/** A short all-capitals code we have no name for is shown as it is, rather than as a misleading "Smug" or "Twi". */
const looksLikeCode = (raw: string) => /^[A-Z0-9_]{2,8}$/.test(raw.trim());
const display = (raw: string) =>
  knownNames[keyNorm(raw)] ?? (looksLikeCode(raw) ? raw.trim() : prettyKey(raw));
/** Specialization keys are whole words (ASSASSIN, CHARMER), so they are simply capitalised. */
const displayWord = (raw: string) => knownNames[keyNorm(raw)] ?? prettyKey(raw);
/** Species or career: look inside the block for a name or key, or take its text, and fall back to a key anywhere in the file. */
function identity(doc: XNode, block: string, nameTag: string, keyTag: string): string {
  const n = all(doc, block)[0];
  const direct =
    (n && (text(first(n, nameTag)) || text(first(n, "Name")) || text(first(n, keyTag)) || text(first(n, "Key")))) ||
    (n && !n.kids.length ? n.text.trim() : "") ||
    firstText(doc, nameTag, keyTag);
  return direct ? display(direct) : "";
}

export type ImportResult = { character: Character; warnings: string[] };

export function importOggDude(xml: string): ImportResult {
  const doc = parseXml(xml);
  if (lc(doc.name) !== "character")
    throw new Error("This does not look like an OggDude character file");
  const warnings: string[] = [];
  const c = emptyCharacter();

  c.name = firstText(doc, "CharName") || undefined;
  c.species = identity(doc, "Species", "SpeciesName", "SpeciesKey") || undefined;
  c.career = identity(doc, "Career", "CareerName", "CareerKey") || undefined;
  if (!c.species) warnings.push("The species was not found in this file.");
  else if (looksLikeCode(c.species) && !knownNames[keyNorm(c.species)])
    warnings.push(`The species is stored as the code "${c.species}"; please type its full name.`);
  if (!c.career) warnings.push("The career was not found in this file.");
  else if (looksLikeCode(c.career) && !knownNames[keyNorm(c.career)])
    warnings.push(`The career is stored as the code "${c.career}"; please type its full name.`);
  const career = all(doc, "Career")[0];

  const specs = new Set<string>();
  const specName = (x: XNode) => text(first(x, "n")) || text(first(x, "Name")) || text(first(x, "Key"));
  const listed = all(doc, "CharSpecialization");
  for (const sp of [...listed.filter((x) => text(first(x, "isStartingSpec")) === "true"), ...listed])
    specs.add(displayWord(specName(sp)));
  if (career) {
    for (const s of all(career, "CharSpecialization"))
      specs.add(displayWord(specName(s)));
    for (const s of all(career, "SpecializationKey")) specs.add(displayWord(text(s)));
    const holder = first(career, "Specializations");
    if (holder && !specs.size)
      for (const k of holder.kids) {
        const v = text(first(k, "Key")) || text(k);
        if (v) specs.add(displayWord(v));
      }
  }
  c.specializations = [...specs].filter(Boolean).slice(0, 20);
  // Each bought talent has a Row and Col in its specialization tree (4 columns), which is where it is ticked in the tree browser.
  const progress = listed
    .map((sp) => ({
      spec: displayWord(specName(sp)),
      nodes: all(sp, "CharTalent")
        .filter((t) => text(first(t, "Purchased")).toLowerCase() === "true")
        .map((t) => (num(text(first(t, "Row"))) ?? -1) * 4 + (num(text(first(t, "Col"))) ?? -1))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < 20),
    }))
    .filter((p) => p.spec && p.nodes.length);
  if (progress.length) c.treeProgress = progress.slice(0, 20);
  for (const name of c.specializations)
    if (!findSpecializationTree(name, c.career))
      warnings.push(`There is no tree image for the specialization "${name}"; add it from Browse trees if you have one.`);

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
    if (!key || retiredSkills.has(keyNorm(key))) continue;
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

  // Derived numbers. Look for a plain tag, a block with a current/maximum inside, or a keyed entry such as <Key>SOAK</Key>.
  const fromBlock = (n: XNode): number | undefined => {
    if (!n.kids.length) return n.text.trim() === "" ? 0 : num(n.text);
    for (const t of ["Threshold", "Max", "Maximum", "Total", "TotalRanks", "Value", "Current"]) {
      const v = firstNum(n, t);
      if (v !== undefined) return v;
    }
    if (first(n, "Rank") || first(n, "Ranks")) return totalRanks(n) || undefined;
    // OggDude stores a derived number as parts, e.g. StartingRanks + SpeciesRanks + TalentRanks. Add the numeric parts up.
    const parts = n.kids.map((k) => num(text(k))).filter((v): v is number => v !== undefined);
    return parts.length ? parts.reduce((a, b) => a + b, 0) : undefined;
  };
  const everyNode = (n: XNode): XNode[] => [n, ...n.kids.flatMap(everyNode)];
  const stat = (tags: string[], keyed: RegExp): number | undefined => {
    for (const t of tags) {
      const node = all(doc, t).find((x) => fromBlock(x) !== undefined);
      if (node) return fromBlock(node);
    }
    for (const n of everyNode(doc)) {
      const label = text(first(n, "Key")) || text(first(n, "n")) || text(first(n, "Name"));
      if (label && keyed.test(keyNorm(label))) {
        const v = fromBlock(n);
        if (v !== undefined) return v;
      }
    }
    return undefined;
  };
  const derived = {
    soak: stat(["Soak", "SoakValue", "TotalSoak"], /^(SOAK|SOAKVALUE)$/),
    woundThreshold: stat(["WoundThreshold", "WoundsThreshold", "WoundThresholdTotal", "Wounds"], /^(WOUNDTHRESHOLD|WOUNDS|WT)$/),
    strainThreshold: stat(["StrainThreshold", "StrainThresholdTotal", "Strain"], /^(STRAINTHRESHOLD|STRAIN|ST)$/),
    defenseRanged: stat(["DefenseRanged", "RangedDefense", "DefRanged"], /^(DEFENSERANGED|RANGEDDEFENSE|DEFRANGED)$/),
    defenseMelee: stat(["DefenseMelee", "MeleeDefense", "DefMelee"], /^(DEFENSEMELEE|MELEEDEFENSE|DEFMELEE)$/),
  };
  for (const [k, v] of Object.entries(derived))
    if (v !== undefined) (c as Record<string, unknown>)[k] = Math.max(0, Math.min(99, Math.round(v)));
  const estimated: string[] = [];
  if (derived.soak === undefined) {
    c.soak = c.characteristics.brawn; // soak is at least Brawn
    estimated.push("soak (Brawn only, armor not counted)");
  }
  const base = speciesBase[keyNorm(c.species ?? "")] ?? speciesBase[keyNorm(text(all(doc, "SpeciesKey")[0]))];
  if (derived.woundThreshold === undefined && base) {
    c.woundThreshold = Math.min(99, base.wounds + c.characteristics.brawn);
    estimated.push("wound threshold (species + Brawn)");
  }
  if (derived.strainThreshold === undefined && base) {
    c.strainThreshold = Math.min(99, base.strain + c.characteristics.willpower);
    estimated.push("strain threshold (species + Willpower)");
  }
  if (estimated.length)
    warnings.push(
      `This file does not store ${estimated.join(", ")}; these were worked out from the species and characteristics, so talents such as Toughened or Grit are not included. Check them below.`,
    );
  const stillZero = [
    derived.woundThreshold === undefined && !base ? "wound threshold" : "",
    derived.strainThreshold === undefined && !base ? "strain threshold" : "",
    derived.defenseRanged === undefined && derived.defenseMelee === undefined ? "defense" : "",
  ].filter(Boolean);
  if (stillZero.length)
    warnings.push(`Not found in this file, so please fill in: ${stillZero.join(", ")}.`);

  return { character: characterSchema.parse(c), warnings };
}
