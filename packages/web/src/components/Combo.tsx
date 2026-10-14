import { useDeferredValue, useId, useMemo, useState } from "react";
import { norm } from "../lib/format";

export interface Option {
  id: number;
  label: string;
  sub?: string;
}

/**
 * Yazarken öneren alan. Listeden seçilirse id döner; serbest metin bırakılırsa id null (yeni kayıt açılabilir).
 */
export function Combo({ id, value, options, onChange, placeholder, allowNew = true }: {
  id?: string;
  value: { id: number | null; text: string };
  options: Option[];
  onChange: (v: { id: number | null; text: string }) => void;
  placeholder?: string;
  allowNew?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const q = useDeferredValue(value.text);

  const hits = useMemo(() => {
    const n = norm(q.trim());
    const list = n ? options.filter((o) => norm(o.label).includes(n) || norm(o.sub).includes(n)) : options;
    return list.slice(0, 7);
  }, [q, options]);

  const exact = hits.find((h) => norm(h.label) === norm(value.text.trim()));
  const pick = (o: Option) => {
    onChange({ id: o.id, text: o.label });
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        className="inp"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        autoComplete="off"
        placeholder={placeholder}
        value={value.text}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onChange({ id: null, text: e.target.value });
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {value.id ? <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-accent-text">seçili</span> : null}
      {!value.id && allowNew && value.text.trim() && !exact ? (
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-text-muted">yeni</span>
      ) : null}
      {open && hits.length > 0 && !value.id ? (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-sheet mt-1 flex flex-col rounded-inner border border-border-menu bg-surface-menu p-1 shadow-menu">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(h)}
                onPointerEnter={() => setActive(i)}
                className={`flex w-full items-baseline gap-3 rounded-md border-0 px-4 py-3 text-left text-base text-text-primary ${i === active ? "bg-surface-menu-hover" : "bg-transparent"}`}
              >
                <span className="truncate">{h.label}</span>
                {h.sub ? <span className="truncate text-sm text-text-secondary">{h.sub}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
