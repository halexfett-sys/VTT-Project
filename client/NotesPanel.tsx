import { useEffect, useRef, useState } from "react";

/**
 * Personal notes that float at the left edge of the map. They are saved to your own profile and are never
 * sent to other players or the GM. Typing saves automatically a moment after you stop.
 */
export default function NotesPanel({
  value,
  send,
}: {
  value: string;
  send: (event: string, payload: unknown, complete?: (ok: boolean) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [state, setState] = useState<"saved" | "saving" | "unsaved">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ text, state, send });
  latest.current = { text, state, send };
  // Follow the server (another tab, a reconnect) unless there are unsaved edits.
  useEffect(() => {
    if (latest.current.state === "saved") setText(value);
  }, [value]);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { text: t, send: s, state: st } = latest.current;
    if (st === "saved") return;
    setState("saving");
    s("profile:update", { notes: t }, (ok) => {
      if (!ok) return setState("unsaved");
      // Still typing? Keep it marked unsaved so the next flush sends the newer text.
      setState(latest.current.text === t ? "saved" : "unsaved");
    });
  };
  useEffect(() => () => {
    // Closing the table or switching view: do not lose the last words.
    if (latest.current.state !== "saved") latest.current.send("profile:update", { notes: latest.current.text });
  }, []);
  if (!open)
    return (
      <button className="notes-tab" onClick={() => setOpen(true)} aria-label="Open my notes" title="My private notes">
        ✎ Notes
      </button>
    );
  return (
    <section className="notes-panel" aria-label="My notes">
      <header>
        <strong>MY NOTES</strong>
        <small>private · only you see this</small>
        <button
          aria-label="Close notes"
          onClick={() => {
            flush();
            setOpen(false);
          }}
        >
          ×
        </button>
      </header>
      <textarea
        value={text}
        maxLength={10000}
        placeholder="Clues, plans, names, reminders…"
        aria-label="My notes"
        onChange={(e) => {
          setText(e.target.value);
          setState("unsaved");
          latest.current = { ...latest.current, text: e.target.value, state: "unsaved" };
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, 800);
        }}
        onBlur={flush}
      />
      <footer>{state === "saved" ? "Saved" : state === "saving" ? "Saving…" : "Unsaved…"}</footer>
    </section>
  );
}
