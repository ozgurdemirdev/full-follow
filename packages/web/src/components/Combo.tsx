import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { BLUR_CLOSE_MS, PICKER_HITS } from "../lib/constants";
import { initials, norm } from "../lib/format";
import { useSearchRows, type SearchPath } from "../lib/useSearchRows";
import { parts } from "../messages.parts";
import { Floating } from "./Floating";
import { FORM_ICON, PathIcon } from "./forms/icons";
import { stroke as STROKE } from "../styles/tokens.json";

export interface Option {
  id: number;
  label: string;
  sub?: string;
  /** the record the option stands for, when it came from the server (so a form can read its other fields) */
  row?: unknown;
}

/** A list the server searches for the options (`GET path?q=`), and how a row of it reads as an option */
export interface RemoteSource {
  path: string;
  params?: SearchPath["params"];
  toOption: (row: any) => Option;
  /** rows to leave out of the list (a person already on the team) */
  keep?: (row: any) => boolean;
}

const m = parts.combo;
const MAX_HITS = 7;
const NO_OPTIONS: Option[] = [];
const KEEP_ALL = () => true;

/**
 * Yazarken öneren alan. Listeden seçilirse id döner; serbest metin bırakılırsa id null (yeni kayıt açılabilir).
 * `form` is the form sheet board's control: search icon, list toggle, initials in front of each hit and, with `newLabel`,
 * a "Yeni firma: “X”" row for text that matches nothing (the record is then created by name on submit).
 */
export function Combo({ id, value, options = NO_OPTIONS, remote, onChange, placeholder, allowNew = true, form, newLabel, invalid }: {
  id?: string;
  value: { id: number | null; text: string };
  /** a fixed list, filtered here as the text is typed */
  options?: Option[];
  /** or lists the server searches as the text is typed (asked only while the list is open); the text is not filtered again here */
  remote?: RemoteSource[];
  onChange: (v: { id: number | null; text: string }, picked?: Option) => void;
  placeholder?: string;
  allowNew?: boolean;
  form?: boolean;
  newLabel?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  /** closes the list shortly after blur so a click on a hit still lands */
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const q = useDeferredValue(value.text);

  // the server's rows: a chosen record shows the first rows again (the form variant lets it be switched)
  const paths = useMemo<SearchPath[]>(() => (remote ?? []).map((r) => ({ path: r.path, params: r.params, limit: PICKER_HITS })), [remote]);
  const found = useSearchRows(paths, form && value.id ? "" : value.text, !!remote && open);
  const fromServer = useMemo(() => (remote ? remote.flatMap((r, i) => (found[i] ?? []).filter(r.keep ?? KEEP_ALL).map(r.toOption)) : null), [remote, found]);

  const hits = useMemo(() => {
    if (fromServer) return fromServer.slice(0, MAX_HITS);
    const n = norm(q.trim());
    // a chosen record shows the whole list again (the form variant lets it be switched)
    const list = n && !(form && value.id) ? options.filter((o) => norm(o.label).includes(n) || norm(o.sub).includes(n)) : options;
    return list.slice(0, MAX_HITS);
  }, [fromServer, q, options, form, value.id]);

  const exact = hits.find((h) => norm(h.label) === norm(value.text.trim()));
  const showNew = !!form && !!newLabel && !value.id && !!value.text.trim() && !exact;
  const pick = (o: Option) => {
    onChange({ id: o.id, text: o.label }, o);
    setOpen(false);
  };
  const listing = open && (hits.length > 0 || showNew) && (form || !value.id);

  const field = (
    <input
      id={id}
      ref={input}
      className={form ? undefined : "inp"}
      role="combobox"
      aria-expanded={listing}
      aria-controls={listId}
      aria-invalid={invalid}
      autoComplete="off"
      placeholder={placeholder}
      value={value.text}
      onFocus={() => {
        clearTimeout(blurTimer.current);
        // the sheet focuses its first field on its own: only a press or typing opens the list there
        if (!form) setOpen(true);
      }}
      onClick={() => form && setOpen(true)}
      onBlur={() => {
        blurTimer.current = setTimeout(() => setOpen(false), BLUR_CLOSE_MS);
      }}
      onChange={(e) => {
        onChange({ id: null, text: e.target.value });
        setActive(0);
        setOpen(true);
      }}
      onKeyDown={(e) => {
        if (!open) {
          if (form && e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((a) => Math.min(a + 1, hits.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === "Enter" && hits[active]) {
          e.preventDefault();
          pick(hits[active]);
        } else if (e.key === "Escape") {
          // closing the list must not close the sheet behind it
          if (form) e.preventDefault();
          setOpen(false);
        }
      }}
    />
  );

  if (form) {
    return (
      <div ref={wrap} className="form-combo">
        <div className="form-control" data-invalid={invalid}>
          <PathIcon d={FORM_ICON.search} className="size-icon-chip form-icon-muted" />
          {field}
          <button
            type="button"
            className="form-icon-btn"
            aria-label={m.openList}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              clearTimeout(blurTimer.current);
              setOpen((o) => !o);
              input.current?.focus();
            }}
          >
            <PathIcon d={FORM_ICON.chevronDown} className="size-icon-xs" stroke={STROKE.regular} />
          </button>
        </div>
        {listing ? (
          <Floating anchor={wrap} open matchWidth className="form-float">
            <ul id={listId} role="listbox" className="form-list">
              {hits.map((h, i) => (
                <li key={h.id} role="option" aria-selected={i === active}>
                  <button type="button" className="form-opt-row" data-active={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)} onPointerEnter={() => setActive(i)}>
                    <span className="form-opt-ini">{initials(h.label)}</span>
                    <span className="form-opt-name">{h.label}</span>
                    {h.sub ? <span className="form-opt-sub">{h.sub}</span> : null}
                  </button>
                </li>
              ))}
              {showNew ? (
                <li role="option" aria-selected="false">
                  <button type="button" className="form-opt-row form-opt-new" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)}>
                    <PathIcon d="M12 5v14M5 12h14" className="size-icon-chip" stroke={STROKE.medium} />
                    {newLabel}: “{value.text.trim()}”
                  </button>
                </li>
              ) : null}
            </ul>
          </Floating>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={wrap} className="relative">
      {field}
      {value.id ? <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-accent-text">{m.selected}</span> : null}
      {!value.id && allowNew && value.text.trim() && !exact ? (
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{m.fresh}</span>
      ) : null}
      {listing ? (
        <Floating anchor={wrap} open matchWidth className="my-1">
          <ul id={listId} role="listbox" className="flex flex-col rounded-inner border border-border-menu bg-surface-menu p-1 shadow-menu">
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
        </Floating>
      ) : null}
    </div>
  );
}
