import { useState, type ReactNode } from "react";
import { SETTINGS_ROW_LIMIT, type SettingRow } from "../../lib/settings";

/** One settings row of the board: name and hint on the left, the control on the right (or under them when wide) */
export function SetRowView({ row }: { row: SettingRow }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <span className="set-row-name">{row.name}</span>
        {row.hint ? <span className="set-row-hint">{row.hint}</span> : null}
      </div>
      {row.wide ? <div className="set-row-wide">{row.control}</div> : row.control}
    </div>
  );
}

/** A category card: title, optional subtitle, its rows; a long list shows a "N more" button */
export function SetSection({ name, sub, empty, rows }: { name: string; sub?: string; empty?: string; rows: SettingRow[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SETTINGS_ROW_LIMIT);
  return (
    <section className="set-group" aria-label={name}>
      <div className="set-group-head">
        <h2>{name}</h2>
        {sub ? <span>{sub}</span> : null}
      </div>
      {shown.map((r) => <SetRowView key={r.id} row={r} />)}
      {rows.length > shown.length ? (
        <button type="button" className="set-more" onClick={() => setAll(true)}>{rows.length - shown.length} kayıt daha</button>
      ) : null}
      {rows.length === 0 && empty ? <p className="set-empty">{empty}</p> : null}
    </section>
  );
}

/** On/off switch of the board; `locked` is the info-only look (dimmed, never changes) */
export function Switch({ label, on, onChange, locked, onLockedClick }: { label: string; on: boolean; onChange?: (v: boolean) => void; locked?: boolean; onLockedClick?: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="set-switch"
      data-locked={locked ? "" : undefined}
      onClick={() => (locked ? onLockedClick?.() : onChange?.(!on))}
    />
  );
}

/** Single choice pills of the board (a radio group) */
export function SetPills<T extends string>({ label, items, value, onChange }: { label: string; items: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <span className="set-pills" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button key={it.value} type="button" role="radio" aria-checked={it.value === value} onClick={() => onChange(it.value)}>{it.label}</button>
      ))}
    </span>
  );
}

/** Chip of a chip row: dot, label (anything clickable inside is the caller's), remove cross */
export function SetChip({ dot, title, remove, removeLabel, children }: { dot: ReactNode; title?: string; remove: () => void; removeLabel: string; children: ReactNode }) {
  return (
    <span className="set-chip" title={title}>
      {dot}
      {children}
      <button type="button" className="set-chip-x" aria-label={removeLabel} onClick={remove}>
        <svg className="size-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </span>
  );
}

/** Nav icon of a category: the board's line icons, 17 units */
export function CatIcon({ d }: { d: string }) {
  return (
    <svg className="size-icon-btn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
