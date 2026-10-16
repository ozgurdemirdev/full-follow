import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { BoardIcon } from "../components/boardIcons";
import { Floating } from "../components/Floating";
import { Icon } from "../components/icons";
import { BLUR_CLOSE_MS, SEARCH_HITS, SEARCH_SOURCE_HITS } from "../lib/constants";
import { useSearchRows } from "../lib/useSearchRows";
import { useRecordHref } from "../lib/useRecordHref";
import { m as kit } from "../messages";
import { shell } from "../messages.shell";
import { useRegistry } from "./modules/registry";
import type { SearchCtx, SearchHit } from "./modules/types";
import { stroke as STROKE } from "../styles/tokens.json";

const m = shell.search;

const NO_HITS: SearchHit[] = [];

/** Üst çubuktaki arama: modüllerin kayıtlı kaynakları (kişi, fırsat, proje ...). ⌘K / Ctrl+K ile odaklanır. Yazılan metin sunucuya sorulur (kaynak başına birkaç satır); kapalıyken hiçbir şey çekilmez. */
export function GlobalSearch({ board = false }: { board?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  /** closes the list shortly after blur so a click on a hit still lands */
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [, navigate] = useLocation();

  const recordHref = useRecordHref();
  const ctx = useMemo<SearchCtx>(() => ({ recordHref }), [recordHref]);
  const { search: sources } = useRegistry();
  const paths = useMemo(() => sources.map((src) => ({ path: src.path, limit: SEARCH_SOURCE_HITS })), [sources]);
  // asked only while something is typed; the sources answer in their own order and the list is the first eight
  const found = useSearchRows(paths, q, q.trim().length > 0);
  const hits = useMemo(
    () => (q.trim() ? sources.flatMap((src, i) => (found[i] ?? []).map((row) => src.hit(row, ctx))).slice(0, SEARCH_HITS) : NO_HITS),
    [sources, found, ctx, q],
  );

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
    <div ref={wrap} className={board ? "relative flex-none" : "relative hidden flex-none desk:block"}>
      <label className={board ? "dash-search" : "flex h-control-height-md w-search-width items-center gap-3 rounded-lg border border-border-default bg-surface-inset px-5 text-text-secondary"}>
        {board ? <BoardIcon name="search" className="size-icon-btn" stroke={STROKE.thin} /> : <Icon name="search" className="size-icon-md" />}
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
        <Floating anchor={wrap} open matchWidth className="my-2">
          <ul id="search-results" role="listbox" className="flex flex-col rounded-card border border-border-menu bg-surface-menu p-2 shadow-menu">
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
        </Floating>
      ) : null}
    </div>
  );
}
