// The richer field types of the form sheet board: combo, tags, offer items, payment plan, template suggestions
import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { fmtNum, lira } from "../../lib/format";
import { m as kit } from "../../messages";
import { forms } from "../../messages.forms";
import { Combo, type Option } from "../Combo";
import { NumberField } from "../NumberField";
import { useFieldError } from "./context";
import { Field, type FieldProps } from "./fields";
import { FORM_ICON, PathIcon } from "./icons";

const m = forms.rich;

// ---------------------------------------------------------------- combo

/** Search with a dropdown; free text stays free (id null) and is created by name on submit when `newLabel` is set */
export function ComboField({ name, label, req, opt, hint, half, value, onChange, options, placeholder, newLabel }: FieldProps & {
  value: { id: number | null; text: string };
  onChange: (v: { id: number | null; text: string }) => void;
  options: Option[];
  placeholder?: string;
  /** "Yeni firma": the row that offers the typed text as a new record */
  newLabel?: string;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <Combo form id={id} value={value} options={options} placeholder={placeholder} newLabel={newLabel} invalid={!!error} onChange={(v) => (touch(), onChange(v))} />
    </Field>
  );
}

// ---------------------------------------------------------------- tags

export interface TagItem {
  key: string | number;
  label: string;
}

/** Removable chips with an input (Enter adds) and dashed suggestions; what a typed text means is up to `onAdd` */
export function TagsField({ name, label, req, opt, hint, half, tags, suggestions, onAdd, onRemove, placeholder }: FieldProps & {
  tags: TagItem[];
  /** labels offered under the field, each adds with one press */
  suggestions: string[];
  onAdd: (text: string) => void;
  onRemove: (key: TagItem["key"]) => void;
  placeholder?: string;
}) {
  const id = useId();
  const { error, touch } = useFieldError(name);
  const [draft, setDraft] = useState("");
  const add = (text: string) => {
    const t = text.trim();
    if (t) {
      touch();
      onAdd(t);
    }
    setDraft("");
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    add(draft);
  };
  return (
    <Field id={id} label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-tags">
        {tags.map((t) => (
          <span key={t.key} className="form-tag">
            {t.label}
            <button type="button" aria-label={m.remove(t.label)} onClick={() => onRemove(t.key)}>
              <PathIcon d={FORM_ICON.close} className="size-form-icon-10" stroke={2.6} />
            </button>
          </span>
        ))}
        <input id={id} type="text" value={draft} placeholder={placeholder} aria-label={label ? m.add(label) : undefined} onChange={(e) => setDraft(e.target.value)} onKeyDown={key} />
      </div>
      {suggestions.length ? (
        <span className="form-suggest">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => add(s)}>+ {s}</button>
          ))}
        </span>
      ) : null}
    </Field>
  );
}

// ---------------------------------------------------------------- offer items

export interface ItemRow {
  /** stable key of the row (rows can be removed) */
  key: number;
  label: string;
  qty: number;
  /** unit price, null while empty */
  unit: number | null;
}

export const itemsTotal = (items: ItemRow[]) => items.reduce((sum, it) => sum + it.qty * (it.unit ?? 0), 0);

let rowSeq = 0;
export const newItemRow = (patch: Partial<ItemRow> = {}): ItemRow => ({ key: ++rowSeq, label: "", qty: 1, unit: null, ...patch });

/** Offer lines: name, quantity stepper, unit price, remove, "+ Kalem ekle" and the live total */
export function ItemsField({ name, label, req, opt, hint, half, items, onChange }: FieldProps & { items: ItemRow[]; onChange: (items: ItemRow[]) => void }) {
  const { error, touch } = useFieldError(name);
  const set = (key: number, patch: Partial<ItemRow>) => {
    touch();
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };
  return (
    <Field label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-items">
        {items.map((it) => (
          <div key={it.key} className="form-item">
            <span className="form-item-cell">
              <input type="text" value={it.label} placeholder={m.itemPlaceholder} aria-label={m.itemName} onChange={(e) => set(it.key, { label: e.target.value })} />
            </span>
            <span className="form-item-cell">
              <button type="button" aria-label={m.qtyDecrease} onClick={() => set(it.key, { qty: Math.max(1, it.qty - 1) })}>−</button>
              <span className="form-item-qty">{it.qty}</span>
              <button type="button" aria-label={m.qtyIncrease} onClick={() => set(it.key, { qty: it.qty + 1 })}>+</button>
            </span>
            <span className="form-item-cell" data-price="">
              <span className="form-affix">{kit.lira}</span>
              <NumberField className="" value={it.unit} min={0} ariaLabel={m.unitAria} onChange={(unit) => set(it.key, { unit })} />
            </span>
            <button type="button" className="form-item-remove" aria-label={m.removeItem} onClick={() => (touch(), onChange(items.filter((x) => x.key !== it.key)))}>
              <PathIcon d={FORM_ICON.close} className="size-form-icon-13" stroke={2.2} />
            </button>
          </div>
        ))}
        <div className="form-items-foot">
          <button type="button" className="form-add" onClick={() => onChange([...items, newItemRow()])}>{m.addItem}</button>
          <span className="form-total">
            <span>{m.total}</span>
            <span>{lira(itemsTotal(items))}</span>
          </span>
        </div>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- payment plan

export interface PlanRow {
  key: string;
  label: string;
  /** share of the total, whole percent */
  pct: number;
}

const PLAN_STEP = 5;
const PLAN_FULL = 100;
const PLAN_COLORS = ["var(--color-accent)", "var(--color-info)", "var(--color-warning)", "var(--color-claude-soft)", "var(--color-entity-source)"];

export const planSum = (rows: PlanRow[]) => rows.reduce((s, r) => s + r.pct, 0);

/** Payment plan: percent steppers with the computed amount, a coloured bar, and a sum that has to reach 100 */
export function PlanField({ name, label, req, opt, hint, half, rows, total, onChange }: FieldProps & { rows: PlanRow[]; total: number; onChange: (rows: PlanRow[]) => void }) {
  const { error, touch } = useFieldError(name);
  const sum = planSum(rows);
  const ok = sum === PLAN_FULL;
  const step = (key: string, delta: number) => {
    touch();
    onChange(rows.map((r) => (r.key === key ? { ...r, pct: Math.max(0, Math.min(PLAN_FULL, r.pct + delta)) } : r)));
  };
  return (
    <Field label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-plan" data-invalid={!ok || !!error}>
        {rows.map((r) => (
          <div key={r.key} className="form-plan-row">
            <span className="form-plan-name">{r.label}</span>
            <span className="form-plan-step">
              <button type="button" aria-label={m.pctDecrease} onClick={() => step(r.key, -PLAN_STEP)}>−</button>
              <span>{m.pct(r.pct)}</span>
              <button type="button" aria-label={m.pctIncrease} onClick={() => step(r.key, PLAN_STEP)}>+</button>
            </span>
            <span className="form-plan-amount">{lira(Math.round((total * r.pct) / PLAN_FULL))}</span>
          </div>
        ))}
        <div className="form-plan-bar">
          {rows.map((r, i) => (
            <span key={r.key} style={{ width: `${Math.min(PLAN_FULL, r.pct)}%`, "--seg": PLAN_COLORS[i % PLAN_COLORS.length] } as CSSProperties} />
          ))}
        </div>
        <span className="form-plan-sum" data-invalid={!ok}>
          {ok ? `Toplam %${PLAN_FULL} · ${lira(total)}` : `Toplam %${sum}, ${sum < PLAN_FULL ? `%${PLAN_FULL - sum} eksik` : `%${sum - PLAN_FULL} fazla`}`}
        </span>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- template suggestions

export interface Suggestion {
  key: string | number;
  name: string;
  meta: string;
  /** reply rate 0..1, null when nothing was sent yet */
  rate: number | null;
}

/** From this reply rate on the rate reads as good (accent), below it as a warning */
export const GOOD_REPLY_RATE = 0.4;

/** Template suggestion cards with their reply rate; picking one fills the text */
export function SuggField({ name, label, req, opt, hint, half, options, value, onPick }: FieldProps & {
  options: Suggestion[];
  value: Suggestion["key"] | null;
  onPick: (s: Suggestion) => void;
}) {
  const { error } = useFieldError(name);
  return (
    <Field label={label} req={req} opt={opt} hint={hint} half={half} error={error}>
      <div className="form-sugg">
        {options.map((s) => (
          <button key={s.key} type="button" aria-pressed={s.key === value} onClick={() => onPick(s)}>
            <span>{s.name}</span>
            <span className="form-sugg-meta">
              <span>{s.meta}</span>
              {s.rate === null ? null : (
                <span className="form-sugg-rate" style={{ "--rate": s.rate >= GOOD_REPLY_RATE ? "var(--color-accent)" : "var(--color-warning)" } as CSSProperties}>
                  {m.replyRate(fmtNum(Math.round(s.rate * 100)))}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </Field>
  );
}
