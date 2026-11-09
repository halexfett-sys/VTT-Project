import { useEffect, useRef, useState } from "react";
import {
  applySkillToPool,
  charKeys,
  charLabels,
  emptyCharacter,
  skillDice,
  skillDefs,
  withAllSkills,
  type CharSkill,
  type Character,
} from "../shared/character";
import { importOggDude } from "../shared/oggdude";
import type { Member, Pool } from "../shared/types";
import NumberField from "./NumberField";
import TreeBrowser from "./TreeBrowser";

type Send = (e: string, p: unknown, cb?: (ok: boolean) => void) => void;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const abbr = (k: string) => charLabels[k as keyof typeof charLabels]?.slice(0, 3).toUpperCase() ?? "";

function Dice({ ability, proficiency }: { ability: number; proficiency: number }) {
  return (
    <span className="skill-dice" aria-hidden="true">
      {Array.from({ length: proficiency }, (_, i) => (
        <img key={`p${i}`} src="/dice/proficiency.png" alt="" />
      ))}
      {Array.from({ length: ability }, (_, i) => (
        <img key={`a${i}`} src="/dice/ability.png" alt="" />
      ))}
    </span>
  );
}

export default function CharacterTab({
  member,
  send,
  setPool,
  setPoolLabel,
  connected,
}: {
  member: Member;
  send: Send;
  setPool: (f: (p: Pool) => Pool) => void;
  setPoolLabel: (s: string) => void;
  connected: boolean;
}) {
  const saved = member.character ?? emptyCharacter();
  const [draft, setDraft] = useState<Character>(saved);
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<{ key: string; name: string; ability: number; proficiency: number } | null>(null);
  // "Hide untrained skills" is remembered on this device until the player unchecks it.
  const [hideUntrained, setHideUntrainedState] = useState(() => {
    try {
      return localStorage.getItem("vtt.hideUntrainedSkills") === "1";
    } catch {
      return false;
    }
  });
  const setHideUntrained = (v: boolean) => {
    setHideUntrainedState(v);
    try {
      if (v) localStorage.setItem("vtt.hideUntrainedSkills", "1");
      else localStorage.removeItem("vtt.hideUntrainedSkills");
    } catch {
      /* storage unavailable: the choice just lasts for this visit */
    }
  };
  const fileRef = useRef<HTMLInputElement>(null);
  // Follow server changes (another tab, a reconnect) unless there are unsaved edits.
  useEffect(() => {
    if (!dirty) setDraft(member.character ?? emptyCharacter());
  }, [member.character, dirty]);
  const edit = (f: (c: Character) => Character) => {
    setDraft((c) => f(structuredClone(c)));
    setDirty(true);
  };
  const skills = withAllSkills(draft);
  const setSkill = (key: string, patch: Partial<CharSkill>) =>
    edit((c) => {
      const all = withAllSkills(c);
      c.skills = all
        .map((s) => (s.key === key ? { ...s, ...patch } : s))
        .filter((s) => s.rank > 0 || s.career || !skillDefs.some((d) => d.key === s.key));
      return c;
    });
  const onFile = async (f: File) => {
    setError("");
    setNotes([]);
    try {
      if (f.size > 5 * 1024 * 1024) throw new Error("XML files must be 5 MB or smaller");
      const { character, warnings } = importOggDude(await f.text());
      setDraft(character);
      setDirty(true);
      setNotes(["Imported. Review the details below, then press Save character.", ...warnings]);
    } catch (e) {
      setError((e as Error).message || "Could not read that file");
    }
  };
  const save = () => {
    send("profile:update", { character: draft }, (ok) => {
      if (ok) setDirty(false);
    });
  };
  const removeCharacter = () => {
    if (
      !window.confirm(
        "Remove this character sheet? Your stats and skills are cleared so you can import a different character. Specialization tree progress is kept.",
      )
    )
      return;
    send("profile:update", { character: null }, (ok) => {
      if (ok) {
        setDraft(emptyCharacter());
        setDirty(false);
        setNotes([]);
        setPicked(null);
        setPoolLabel("");
      }
    });
  };
  const choose = (s: CharSkill) => {
    setPool((p) => applySkillToPool(p, draft, s));
    setPoolLabel(`${s.name} check`);
    const d = skillDice(draft, s);
    setPicked({ key: s.key, name: s.name, ...d });
  };
  const groups = ["General", "Combat", "Knowledge"] as const;
  const group = (s: CharSkill) => skillDefs.find((d) => d.key === s.key)?.group ?? "General";
  const text = (k: "name" | "species" | "career", label: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={draft[k] ?? ""}
        maxLength={80}
        onChange={(e) => edit((c) => ({ ...c, [k]: e.target.value }))}
      />
    </label>
  );
  const nf = (
    label: string,
    value: number,
    set: (c: Character, v: number) => void,
    max = 99,
    min = 0,
  ) => (
    <label className="field">
      <span>{label}</span>
      <NumberField
        label={label}
        value={value}
        min={min}
        max={max}
        onCommit={(v) =>
          edit((c) => {
            set(c, v);
            return c;
          })
        }
      />
    </label>
  );
  return (
    <>
      <div className="section-heading">
        <h3>Character data</h3>
        <span>◈</span>
      </div>
      <button className="full" onClick={() => fileRef.current?.click()}>
        Import OggDude XML
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        hidden
        aria-label="OggDude character XML"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
      {(member.character || dirty) && (
        <button className="danger-button full" onClick={removeCharacter} disabled={!connected || !member.character}>
          Remove character sheet
        </button>
      )}
      <p className="hint">Exported from OggDude’s Character Generator · up to 5 MB · read in your browser.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notes.length > 0 && (
        <ul className="import-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="stack">
        {text("name", "Character name")}
        {text("species", "Species")}
        {text("career", "Career")}
        <label className="field">
          <span>Specializations (comma separated)</span>
          <input
            value={draft.specializations.join(", ")}
            onChange={(e) =>
              edit((c) => ({
                ...c,
                specializations: e.target.value
                  .split(",")
                  .map((s) => s.trimStart().slice(0, 80))
                  .slice(0, 20),
              }))
            }
          />
        </label>
        <div className="two-col">
          {charKeys.map((k) =>
            nf(charLabels[k], draft.characteristics[k], (c, v) => (c.characteristics[k] = v), 10),
          )}
        </div>
        <div className="two-col">
          {nf("Soak", draft.soak, (c, v) => (c.soak = v))}
          {nf("Credits", draft.credits, (c, v) => (c.credits = v), 1e12)}
          {nf("Wound threshold", draft.woundThreshold, (c, v) => (c.woundThreshold = v))}
          {nf("Strain threshold", draft.strainThreshold, (c, v) => (c.strainThreshold = v))}
          {nf("Defense · ranged", draft.defenseRanged, (c, v) => (c.defenseRanged = v))}
          {nf("Defense · melee", draft.defenseMelee, (c, v) => (c.defenseMelee = v))}
        </div>
        <div className="two-col">
          <label className="field">
            <span>Track</span>
            <select
              value={draft.counterKind}
              onChange={(e) =>
                edit((c) => ({ ...c, counterKind: e.target.value as Character["counterKind"] }))
              }
            >
              <option>Obligation</option>
              <option>Duty</option>
              <option>Morality</option>
            </select>
          </label>
          {nf(`${draft.counterKind} (1–100)`, draft.counter, (c, v) => (c.counter = v), 100, 1)}
        </div>
      </div>

      <div className="section-heading separated">
        <h3>Skills</h3>
        <span>⚄</span>
      </div>
      <p className="hint">
        Click a skill to load its ability and proficiency dice into the roller. Boost, setback and difficulty
        dice you already chose are kept.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={hideUntrained}
          onChange={(e) => setHideUntrained(e.target.checked)}
        />
        Hide untrained skills
      </label>
      {picked && (
        <p className="pool-picked" role="status">
          <strong>{picked.name}</strong>
          <Dice ability={picked.ability} proficiency={picked.proficiency} />
          <span>added to the dice pool</span>
        </p>
      )}
      {groups.map((g) => {
        const rows = skills.filter(
          (s) => group(s) === g && (!hideUntrained || s.rank > 0 || s.career),
        );
        if (!rows.length) return null;
        return (
          <div key={g} className="skill-group">
            <h4>{g}</h4>
            {rows.map((s) => {
              const d = skillDice(draft, s);
              return (
                <div className={`skill-row${picked?.key === s.key ? " active" : ""}`} key={s.key}>
                  <button
                    className="skill-pick"
                    aria-pressed={picked?.key === s.key}
                    onClick={() => choose(s)}
                    title={`Add ${s.name} to the dice pool`}
                  >
                    <span className="skill-name">
                      {s.career && <b title="Career skill">◆</b>} {s.name}
                      <small> {abbr(s.characteristic)}</small>
                    </span>
                    <Dice {...d} />
                  </button>
                  <span className="skill-rank">
                    <button
                      aria-label={`Lower ${s.name} rank`}
                      disabled={s.rank <= 0}
                      onClick={() => setSkill(s.key, { rank: s.rank - 1 })}
                    >
                      −
                    </button>
                    <output aria-label={`${s.name} rank`}>{s.rank}</output>
                    <button
                      aria-label={`Raise ${s.name} rank`}
                      disabled={s.rank >= 6}
                      onClick={() => setSkill(s.key, { rank: s.rank + 1 })}
                    >
                      +
                    </button>
                    <input
                      type="checkbox"
                      aria-label={`${s.name} is a career skill`}
                      title="Career skill"
                      checked={s.career}
                      onChange={(e) => setSkill(s.key, { career: e.target.checked })}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="save-bar">
        <button className="primary full" disabled={!dirty || !connected} onClick={save}>
          {dirty ? "Save character" : "Character saved"}
        </button>
        {dirty && !same(draft, saved) && (
          <button className="full" onClick={() => { setDraft(saved); setDirty(false); setNotes([]); }}>
            Discard changes
          </button>
        )}
      </div>
      <TreeBrowser member={member} send={send} />
    </>
  );
}
