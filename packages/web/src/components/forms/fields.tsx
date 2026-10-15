// Field types of the form sheet board: text, area, chips, seg, num, date, time, toggle (the richer ones live in fields-rich.tsx)
import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatDate, formatDateTime, parseDate, parseDateTime, parseTime, quickDates } from "../../lib/dateInput";
import { m as kit } from "../../messages";
import { forms } from "../../messages.forms";
import { MicButton } from "../MicButton";
import { NumberField } from "../NumberField";
import { useFieldError } from "./context";
import { FORM_ICON, PathIcon } from "./icons";

const m = forms.fields;

const DEFAULT_TIME = "09:00";
const SPLIT_DATE = 10;

// ---------------------------------------------------------------- frame

/** Label (with the required star or the optional note), the control, then the error and hint lines */
export function Field({ id, label, req, opt, hint, half, error, children }: {
  id?: string;
  label?: string;
  req?: boolean;
  opt?: boolean;
  hint?: string;
  half?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const text = label ? (
    <>
      {label}
      {req ? <span className="form-req">*</span> : null}
      {opt ? <span className="form-opt">{kit.optional}</span> : null}
    </>
  ) : null;
  return (
    <div className="form-field" data-half={half ? "" : undefined}>
      {text ? (id ? <label htmlFor={id} className="form-label">{text}</label> : <span className="form-label">{text}</span>) : null}
      {children}
      {error ? (
        <span role="alert" className="form-err">
          <PathIcon d={FORM_ICON.alert} className="size-form-icon-13" stroke={2.2} />
          {error}
        </span>
      ) : null}
      {hint ? <span className="form-hint">{hint}</span> : null}
    </div>
  );
}

/** Props every field takes: its error key, label and the lines around the control */
export interface FieldProps {
  /** key of this field's error in the sheet (see useFieldError) */
  name?: string;
  label?: string;
  req?: boolean;
  opt?: boolean;
  hint?: string;
  half?: boolean;
}

// ---------------------------------------------------------------- text

export function TextField({ name, label, req, opt, hint, half, value, onChange, placeholder, prefix, type = "text", autoFocus }: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** muted text in front ("@", "https://", "in/") */
  prefix?: string;
  type?: "text" | "email" | "tel" | "url";
  autoFocus?: boolean;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-control" data-invalid={!!error}>
        {prefix ? <span className="form-affix">{prefix}</span> : null}
        <input
          id={id}
          type={type}
          inputMode={type === "tel" ? "tel" : type === "email" ? "email" : type === "url" ? "url" : undefined}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error}
          autoFocus={autoFocus}
          onChange={(e) => (touch(), onChange(e.target.value))}
        />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- area

export function AreaField({ name, label, req, opt, hint, half, value, onChange, placeholder, rows = 4, tokens, mic = true }: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  /** insert chips ("{ad}", "{firma}") that land at the caret */
  tokens?: string[];
  /** dictation button */
  mic?: boolean;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  const area = useRef<HTMLTextAreaElement>(null);
  const insert = (tok: string) => {
    const el = area.current;
    const from = el?.selectionStart ?? value.length;
    const to = el?.selectionEnd ?? from;
    touch();
    onChange(value.slice(0, from) + tok + value.slice(to));
    requestAnimationFrame(() => {
      if (!el?.isConnected) return;
      el.focus();
      el.setSelectionRange(from + tok.length, from + tok.length);
    });
  };
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-area" data-invalid={!!error}>
        <textarea
          ref={area}
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error}
          onChange={(e) => (touch(), onChange(e.target.value))}
        />
        {mic ? <MicButton onText={(t) => (touch(), onChange(value ? `${value} ${t}` : t))} /> : null}
      </div>
      {tokens?.length ? (
        <span className="form-tokens">
          {m.tokens}
          {tokens.map((t) => (
            <button key={t} type="button" className="form-token" onClick={() => insert(t)}>{t}</button>
          ))}
        </span>
      ) : null}
    </Field>
  );
}

// ---------------------------------------------------------------- chips and seg

export interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
  /** colour of the dot in front (a CSS colour value) */
  dot?: string;
}

/** Single choice as round chips; `clearable` lets the chosen one be unpicked */
export function ChipsField<T extends string>({ name, label, req, opt, hint, half, options, value, onChange, clearable }: FieldProps & {
  options: ChoiceOption<T>[];
  value: T | "";
  onChange: (v: T | "") => void;
  clearable?: boolean;
}) {
  const { error, touch } = useFieldError(name);
  return (
    <Field label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <span className="form-chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className="form-chip"
            aria-pressed={o.value === value}
            onClick={() => (touch(), onChange(clearable && o.value === value ? "" : o.value))}
          >
            {o.dot ? <i style={{ "--dot": o.dot } as CSSProperties} /> : null}
            {o.label}
          </button>
        ))}
      </span>
    </Field>
  );
}

/** Several choices as round chips (days of the week) */
export function MultiChipsField<T extends string | number>({ name, label, req, opt, hint, half, options, value, onChange }: FieldProps & {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const { error, touch } = useFieldError(name);
  const toggle = (v: T) => {
    touch();
    onChange(value.includes(v) ? value.filter((x) => x !== v) : options.map((o) => o.value).filter((x) => x === v || value.includes(x)));
  };
  return (
    <Field label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <span className="form-chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" className="form-chip" aria-pressed={value.includes(o.value)} onClick={() => toggle(o.value)}>{o.label}</button>
        ))}
      </span>
    </Field>
  );
}

/** Single choice as one pill (few, short options) */
export function SegField<T extends string>({ name, label, req, opt, hint, half, options, value, onChange }: FieldProps & {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { error, touch } = useFieldError(name);
  return (
    <Field label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-seg" role="radiogroup" aria-label={label} data-invalid={!!error}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => (touch(), onChange(o.value))}>
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- number

export function NumField({ name, label, req, opt, hint, half, value, onChange, min = 0, max, step = 1, prefix, suffix, placeholder }: FieldProps & {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  /** amount of one minus / plus press */
  step?: number;
  /** unit before the number ("₺") and after it ("/ ay", "gün", "adet") */
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  const bump = (dir: 1 | -1) => {
    touch();
    const next = (value ?? 0) + dir * step;
    onChange(Math.min(max ?? Infinity, Math.max(min, next)));
  };
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-control form-num" data-invalid={!!error}>
        <button type="button" className="form-step" aria-label={m.decrease} onClick={() => bump(-1)}>−</button>
        <span className="form-num-mid">
          {prefix ? <span className="form-affix">{prefix}</span> : null}
          <NumberField id={id} className="" min={min} max={max} value={value} placeholder={placeholder} ariaLabel={label} onChange={(v) => (touch(), onChange(v))} />
          {suffix ? <span className="form-affix" data-suffix="">{suffix}</span> : null}
        </span>
        <button type="button" className="form-step" aria-label={m.increase} onClick={() => bump(1)}>+</button>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- date and time

/** A typed value that is turned into a normal one on blur; `bad` while the text is not understood */
function useTypedValue<V extends string>(shown: string, parse: (text: string) => V | null, onChange: (v: V | "") => void) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  return {
    text: draft ?? shown,
    bad,
    type: (text: string) => {
      setDraft(text);
      setBad(false);
      if (!text.trim()) return onChange("");
      const v = parse(text);
      if (v !== null) onChange(v);
    },
    blur: () => {
      if (draft === null) return;
      if (draft.trim() && parse(draft) === null) return setBad(true);
      setDraft(null);
    },
    reset: () => {
      setDraft(null);
      setBad(false);
    },
  };
}

/** Date typed as text ("17 Ekim", "yarın", "cuma"), quick chips and a native picker behind the icon; with `withTime` the value is "YYYY-MM-DDTHH:mm" */
export function DateField({ name, label, req, opt, hint, half, value, onChange, placeholder, quick, withTime }: FieldProps & {
  /** ISO date ("2026-10-17") or, with `withTime`, local date and time */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  quick?: boolean;
  withTime?: boolean;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  const picker = useRef<HTMLInputElement>(null);
  const day = value.slice(0, SPLIT_DATE);
  const time = value.slice(SPLIT_DATE + 1) || DEFAULT_TIME;
  const join = (d: string) => (d && withTime ? `${d}T${time}` : d);
  const t = useTypedValue(
    withTime ? formatDateTime(value) : formatDate(value),
    (text) => (withTime ? parseDateTime(text, time) : parseDate(text)),
    (v) => (touch(), onChange(v)),
  );
  const pick = (d: string) => {
    touch();
    t.reset();
    onChange(join(d));
  };
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error ?? (t.bad ? m.dateBad : undefined)}>
      <div className="form-control" data-invalid={!!error || t.bad}>
        <button type="button" className="form-icon-btn" aria-label={m.datePick} onClick={() => picker.current?.showPicker?.()}>
          <PathIcon d={FORM_ICON.calendar} className="size-icon-chip" />
        </button>
        <input id={id} type="text" value={t.text} placeholder={placeholder} aria-invalid={!!error || t.bad} onChange={(e) => t.type(e.target.value)} onBlur={t.blur} />
        <input ref={picker} type="date" className="form-native-date" tabIndex={-1} aria-hidden="true" value={day} onChange={(e) => pick(e.target.value)} />
      </div>
      {quick ? (
        <span className="form-quick">
          {quickDates().map((q) => (
            <button key={q.label} type="button" aria-pressed={day === q.iso} onClick={() => pick(q.iso)}>{q.label}</button>
          ))}
        </span>
      ) : null}
    </Field>
  );
}

/** Time of day typed as text ("11:30"); empty means no time */
export function TimeField({ name, label, req, opt, hint, half, value, onChange, placeholder }: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  const t = useTypedValue(value, parseTime, (v) => (touch(), onChange(v)));
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error ?? (t.bad ? m.timeBad : undefined)}>
      <div className="form-control" data-invalid={!!error || t.bad}>
        <PathIcon d={FORM_ICON.clock} className="size-icon-chip form-icon-soft" />
        <input id={id} type="text" inputMode="numeric" value={t.text} placeholder={placeholder} aria-invalid={!!error || t.bad} onChange={(e) => t.type(e.target.value)} onBlur={t.blur} />
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- toggle

export function ToggleField({ label, hint, half, value, onChange }: FieldProps & { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field half={half}>
      <div className="form-toggle">
        <span className="form-toggle-text">
          <span>{label}</span>
          {hint ? <span className="form-toggle-hint">{hint}</span> : null}
        </span>
        <button type="button" role="switch" className="set-switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)} />
      </div>
    </Field>
  );
}
