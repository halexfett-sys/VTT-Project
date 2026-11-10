import { useState } from "react";
import { characterTokenStats } from "../shared/character";
import {
  defaultSheet,
  type Asset,
  type Member,
  type Sheet,
  type Token,
  type TokenAppearanceStyle,
} from "../shared/types";
import TokenAppearance from "./TokenAppearance";

export type TokenDraftStart = {
  name: string;
  assetId?: string;
  ownerId?: string;
  size: number;
};

const sheetLabels: Record<Exclude<keyof Sheet, "notes">, string> = {
  wounds: "Wounds · current",
  woundThreshold: "Wounds · threshold",
  strain: "Strain · current",
  strainThreshold: "Strain · threshold",
  soak: "Soak",
  defense: "Defense",
  credits: "Credits",
};

/**
 * Edit a token (name, size, picture, colors, stats…) before it is placed on the table.
 * Nothing is sent to the server until "Place on table" is pressed.
 */
export default function TokenDraftModal({
  start,
  room,
  assets,
  members,
  me,
  gm,
  placing,
  onPlace,
  onClose,
}: {
  start: TokenDraftStart;
  room: string;
  assets: Asset[];
  members: Member[];
  me: Member;
  gm: boolean;
  placing: boolean;
  onPlace: (payload: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(start.name);
  const [size, setSize] = useState(start.size);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState("");
  const [ownerId, setOwnerId] = useState(gm ? start.ownerId || me.userId : me.userId);
  const [hidden, setHidden] = useState(false);
  const owner = members.find((m) => m.userId === ownerId);
  // A token named after the character starts with that character's stats.
  const [sheet, setSheet] = useState<Sheet>(() => {
    const ch = owner?.character;
    const same = ch?.name && ch.name.trim().toLowerCase() === start.name.trim().toLowerCase();
    return ch && same ? { ...defaultSheet(), ...characterTokenStats(ch) } : defaultSheet();
  });
  const [look, setLook] = useState<{
    assetId: string | null;
    backAssetId: string | null;
    appearance?: TokenAppearanceStyle;
  }>({ assetId: start.assetId ?? null, backAssetId: null });
  const preview: Token = {
    id: "draft",
    mapId: "",
    ownerId,
    name: name || "?",
    assetId: start.assetId,
    x: 0,
    y: 0,
    size,
    rotation,
    status,
    hidden,
    z: 0,
    sheet,
  };
  const setNum = (k: keyof Sheet, v: string) =>
    setSheet((s) => ({ ...s, [k]: Math.max(0, Number(v) || 0) }));
  const place = () => {
    if (!name.trim()) return;
    onPlace({
      name: name.trim(),
      size,
      rotation,
      status,
      sheet,
      ...(look.assetId ? { assetId: look.assetId } : {}),
      ...(look.backAssetId ? { backAssetId: look.backAssetId } : {}),
      ...(look.appearance ? { appearance: look.appearance } : {}),
      ...(gm ? { ownerId, hidden } : {}),
    });
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal sheet-modal"
        role="dialog"
        aria-label="Edit token before placing"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="Cancel" onClick={onClose}>
          ×
        </button>
        <div className="eyebrow">NEW TOKEN</div>
        <h2>{name || "New token"}</h2>
        <p className="hint">Adjust the token, then place it on the table.</p>
        <TokenAppearance
          token={preview}
          room={room}
          assets={assets}
          ownerColor={owner?.color || me.color || "#6dd5dd"}
          send={() => {}}
          draft={{ onChange: setLook }}
        />
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            place();
          }}
        >
          <label className="field">
            <span>Token name</span>
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="two-col">
            <label className="field">
              <span>Size (grid units)</span>
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={size}
                onChange={(e) =>
                  setSize(Math.min(10, Math.max(0.5, Number(e.target.value) || 1)))
                }
              />
            </label>
            <label className="field">
              <span>Rotation (degrees)</span>
              <input
                type="number"
                min={-360}
                max={360}
                value={rotation}
                onChange={(e) =>
                  setRotation(Math.min(360, Math.max(-360, Number(e.target.value) || 0)))
                }
              />
            </label>
          </div>
          <label className="field">
            <span>Status marker</span>
            <input
              maxLength={30}
              placeholder="e.g. Stunned"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </label>
          {gm && (
            <>
              <label className="field">
                <span>Controlled by</span>
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                />
                Place hidden from players
              </label>
            </>
          )}
          <h3>Character sheet</h3>
          {owner?.character && (
            <button
              type="button"
              onClick={() =>
                setSheet((s) => ({ ...s, ...characterTokenStats(owner.character!) }))
              }
            >
              Fill from {owner.character.name || owner.name}'s character sheet
            </button>
          )}
          <div className="two-col">
            {(Object.keys(sheetLabels) as (keyof typeof sheetLabels)[]).map((k) => (
              <label className="field" key={k}>
                <span>{sheetLabels[k]}</span>
                <input
                  type="number"
                  min={0}
                  max={k === "credits" ? 1e12 : 9999}
                  value={sheet[k]}
                  onChange={(e) => setNum(k, e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea
              rows={3}
              maxLength={10000}
              value={sheet.notes}
              onChange={(e) => setSheet((s) => ({ ...s, notes: e.target.value }))}
            />
          </label>
          <div className="two-col">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={placing || !name.trim()}>
              {placing ? "Placing…" : "Place on table"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
