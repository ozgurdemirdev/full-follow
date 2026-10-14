import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

const LOCALE = "tr-TR";
const show = (n: number | null, prefix = "", suffix = "") => (n === null ? "" : `${prefix}${n.toLocaleString(LOCALE)}${suffix}`);
const digitsOf = (s: string) => s.replace(/\D/g, "");
const clamp = (n: number, min?: number, max?: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));

/**
 * Whole number input without native spinners: shows Turkish thousand separators (45.000), parses by stripping
 * non digits. Optional pill stepper (minus and plus buttons, like the settings board).
 */
export function NumberField({
  value, onChange, min, max, step = 1, stepper, prefix, suffix, id, className = "inp inp-num", placeholder, ariaLabel, required, autoFocus, onKeyDown,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  /** pill with minus and plus buttons around the value */
  stepper?: boolean;
  /** unit text shown around the number ("₺" before, " gün" after); digits only are parsed back */
  prefix?: string;
  suffix?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  /** digits left of the caret after the last keystroke, so formatting does not push the caret to the end */
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = input.current;
    if (caret.current === null || !el || document.activeElement !== el) return;
    let seen = 0;
    let pos = 0;
    while (pos < el.value.length && seen < caret.current) {
      if (/\d/.test(el.value[pos])) seen++;
      pos++;
    }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  });

  const typed = (raw: string, at: number | null) => {
    const digits = digitsOf(raw);
    caret.current = at === null ? null : digitsOf(raw.slice(0, at)).length;
    onChange(digits ? Number(digits) : null);
  };
  const bump = (dir: 1 | -1) => onChange(clamp((value ?? 0) + dir * step, min, max));
  const settle = () => value !== null && onChange(clamp(value, min, max));

  const field = (
    <input
      ref={input}
      id={id}
      className={stepper ? undefined : className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      aria-label={ariaLabel}
      required={required}
      autoFocus={autoFocus}
      value={show(value, prefix, suffix)}
      onChange={(e) => typed(e.target.value, e.target.selectionStart)}
      onBlur={settle}
      onKeyDown={onKeyDown}
    />
  );
  if (!stepper) return field;
  return (
    <span className="ff-stepper">
      <button type="button" aria-label="Azalt" disabled={min !== undefined && (value ?? 0) <= min} onClick={() => bump(-1)}>−</button>
      {field}
      <button type="button" aria-label="Artır" disabled={max !== undefined && (value ?? 0) >= max} onClick={() => bump(1)}>+</button>
    </span>
  );
}
