import { useEffect, useState } from "react";

/**
 * A number box you can actually type in. The text is kept locally while you type (blank, "-", "1." are all
 * allowed) and the value is committed, clamped to min/max, when you press Enter or leave the box.
 * Escape puts the previous value back. This replaces inputs that re-sent (and re-clamped) the value on
 * every keystroke, which made it impossible to type a number such as 120 when the minimum was 16.
 */
export default function NumberField({
  value,
  onCommit,
  min = 0,
  max = 99999,
  decimals = false,
  label,
  className,
  disabled,
}: {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  decimals?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(String(value));
  }, [value, focus]);
  const commit = () => {
    const n = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(n)) return setText(String(value));
    let v = Math.min(max, Math.max(min, decimals ? n : Math.round(n)));
    if (decimals) v = Math.round(v * 100) / 100;
    setText(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <input
      className={className}
      type="text"
      inputMode={decimals ? "decimal" : min < 0 ? "text" : "numeric"}
      aria-label={label}
      disabled={disabled}
      value={text}
      onFocus={(e) => {
        setFocus(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const allowed = decimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
        if (allowed.test(e.target.value) && (min < 0 || !e.target.value.includes("-")))
          setText(e.target.value);
      }}
      onBlur={() => {
        setFocus(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setText(String(value));
          e.currentTarget.blur();
        }
      }}
    />
  );
}
