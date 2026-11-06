import { useState } from "react";
import type { Campaign, Slot } from "../shared/types";
import { assetUrl } from "./api";

/** Avatar + name for one initiative slot. Players see a masked "Unknown combatant" for slots the GM has hidden. */
export function SlotFace({
  state,
  slot,
  index,
  gm,
  room,
}: {
  state: Campaign;
  slot: Slot;
  index: number;
  gm: boolean;
  room: string;
}) {
  const masked = Boolean(slot.hidden) && !gm;
  const token = !masked && slot.tokenId ? state.tokens.find((t) => t.id === slot.tokenId) : undefined;
  const label = masked
    ? "Unknown combatant"
    : slot.name || token?.name || `${slot.type} slot ${index + 1}`;
  return (
    <span className="slot-face">
      <span
        className={`slot-avatar ${slot.type === "NPC" ? "npc" : "pc"} ${masked ? "masked" : ""}`}
        aria-hidden="true"
      >
        {masked ? (
          "?"
        ) : token?.assetId ? (
          <img src={assetUrl(room, token.assetId)} alt="" />
        ) : (
          label.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="slot-text">
        <b>{label}</b>
        <small>
          {masked
            ? "Hidden by the GM"
            : `${slot.type} · ${slot.success} S · ${slot.advantage} A${slot.hidden ? " · hidden from players" : ""}`}
        </small>
      </span>
    </span>
  );
}

/**
 * Floating turn order shown to everyone as soon as the GM builds an initiative order. Each person can close it;
 * it comes back by itself when the GM adds more combatants.
 */
export default function InitiativePopout({
  state,
  gm,
  room,
  send,
}: {
  state: Campaign;
  gm: boolean;
  room: string;
  send: (event: string, payload: unknown) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const slots = state.initiative.slots;
  if (!slots.length || !slots.some((s) => !dismissed.has(s.id))) return null;
  const next = slots.findIndex((s) => !s.used);
  return (
    <aside className="init-popout" aria-label="Initiative order">
      <header>
        <strong>Initiative · Round {state.initiative.round}</strong>
        <span>
          <button
            aria-label={collapsed ? "Expand initiative order" : "Collapse initiative order"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? "▾" : "▴"}
          </button>
          <button
            aria-label="Close initiative order"
            onClick={() => setDismissed(new Set(slots.map((s) => s.id)))}
          >
            ✕
          </button>
        </span>
      </header>
      {!collapsed && (
        <ol>
          {slots.map((s, i) => (
            <li key={s.id} className={`${s.used ? "used" : ""} ${i === next ? "current" : ""}`}>
              <button
                className="init-row"
                onClick={() => send("initiative:use", { id: s.id })}
                disabled={!gm && s.type === "NPC"}
                title={s.used ? "Mark as not yet acted" : "Mark as acted"}
              >
                <em>{i + 1}</em>
                <SlotFace state={state} slot={s} index={i} gm={gm} room={room} />
                <span aria-hidden="true">{s.used ? "✓" : i === next ? "▶" : ""}</span>
              </button>
              {gm && (
                <button
                  className="init-eye"
                  aria-label={s.hidden ? `Show ${s.name || "combatant"} to players` : `Hide ${s.name || "combatant"} from players`}
                  title={s.hidden ? "Hidden from players — click to show" : "Visible to players — click to hide"}
                  onClick={() => send("initiative:update", { id: s.id, hidden: !s.hidden })}
                >
                  {s.hidden ? "Hidden" : "Shown"}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
