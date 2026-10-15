import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "../api/store";
import type { List } from "../api/types";
import { BoardIcon } from "../components/boardIcons";
import { Icon } from "../components/icons";
import { BLUR_CLOSE_MS, SEARCH_HITS } from "../lib/constants";
import { norm } from "../lib/format";
import { useRecordHref } from "../lib/useRecordHref";
import { m as kit } from "../messages";
import { shell } from "../messages.shell";
import { useRegistry } from "./modules/registry";
import type { SearchCtx, SearchHit, SearchSource } from "./modules/types";

const m = shell.search;

const NO_HITS: SearchHit[] = [];

/** Reads one source's list (the data key the screens share, so it is one request) and reports its matching rows; renders nothing */
function SourceRunner({ source, armed, q, ctx, report }: { source: SearchSource; armed: boolean; q: string; ctx: SearchCtx; report: (id: string, hits: SearchHit[]) => void }) {
  const rows = useQuery<List<unknown>>(armed ? source.dataKey : null).data?.rows;
  const hits = useMemo(() => (armed && q && rows ? rows.flatMap((r) => source.match(r, q, ctx) ?? []) : NO_HITS), [armed, q, rows, source, ctx]);
  useEffect(() => {
    report(source.id, hits);
    return () => report(source.id, NO_HITS);
  }, [source.id, hits, report]);
  return null;
}

/** Üst çubuktaki arama: modüllerin kayıtlı kaynakları (kişi, fırsat, proje ...). ⌘K / Ctrl+K ile odaklanır. Listeler ilk odakta yüklenir. */
export function GlobalSearch({ board = false }: { board?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [armed, setArmed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** closes the list shortly after blur so a click on a hit still lands */
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [, navigate] = useLocation();
  const dq = useDeferredValue(q);

  const recordHref = useRecordHref();
  const ctx = useMemo<SearchCtx>(() => ({ recordHref }), [recordHref]);
  const { search: sources } = useRegistry();
  const [byId, setById] = useState<Record<string, SearchHit[]>>({});
  const report = useCallback((id: string, found: SearchHit[]) => setById((prev) => (prev[id] === found ? prev : { ...prev, [id]: found })), []);
  const folded = dq.trim() ? norm(dq.trim()) : "";
  // the sources report in their own order; the list is the first eight
  const hits = useMemo(() => sources.flatMap((src) => byId[src.id] ?? NO_HITS).slice(0, SEARCH_HITS), [sources, byId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(blurTimer.current);
    };
  }, []);

  const go = (h: SearchHit) => {
    navigate(h.href);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className={board ? "relative flex-none" : "relative hidden flex-none desk:block"}>
      {sources.map((src) => <SourceRunner key={src.id} source={src} armed={armed} q={folded} ctx={ctx} report={report} />)}
      <label className={board ? "dash-search" : "flex h-control-height-md w-search-width items-center gap-3 rounded-lg border border-border-default bg-surface-inset px-5 text-text-secondary"}>
        {board ? <BoardIcon name="search" className="size-icon-btn" stroke={1.8} /> : <Icon name="search" className="size-icon-md" />}
        <input
          ref={input}
          type="search"
          placeholder={board ? m.board : m.topbar}
          aria-label={kit.search}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-controls="search-results"
          value={q}
          onFocus={() => {
            clearTimeout(blurTimer.current);
            setArmed(true);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), BLUR_CLOSE_MS);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter" && hits[active]) go(hits[active]);
            else if (e.key === "Escape") input.current?.blur();
          }}
          className={`min-w-0 flex-grow border-0 bg-transparent text-text-primary outline-0 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden ${board ? "text-base" : "text-base-sm"}`}
        />
        {board ? <kbd className="dash-kbd">{m.shortcut}</kbd> : null}
      </label>
      {open && hits.length > 0 ? (
        <ul id="search-results" role="listbox" className="absolute right-0 top-full z-sheet mt-2 flex w-full flex-col rounded-card border border-border-menu bg-surface-menu p-2 shadow-menu">
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h)}
                onPointerEnter={() => setActive(i)}
                className={`flex w-full flex-col items-start gap-0.5 rounded-lg border-0 px-4 py-3 text-left ${i === active ? "bg-surface-menu-hover" : "bg-transparent"}`}
              >
                <span className="text-base text-text-primary">{h.label}</span>
                <span className="text-sm text-text-secondary">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
