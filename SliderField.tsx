import { useEffect, useState } from "react";

/**
 * A labelled slider that shows its value while you drag and only commits (sends to the server) when you let go,
 * so dragging does not flood the table with updates.
 */
export default function SliderField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  unit = "px",
  live = false,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Commit on every change (for settings that only live in this browser). */
  live?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  return (
    <label className="field slider-field">
      <span>
        {label} · {v}
        {unit}
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => {
          const n = Number(e.target.value);
          setV(n);
          if (live) onCommit(n);
        }}
        onPointerUp={live ? undefined : commit}
        onTouchEnd={live ? undefined : commit}
        onKeyUp={live ? undefined : commit}
        onBlur={live ? undefined : commit}
      />
    </label>
  );
}
