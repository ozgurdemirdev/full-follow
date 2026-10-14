import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useOpps, usePeople, useProjects } from "../api/keys";
import { useModules } from "../api/modules";
import { BoardIcon } from "../components/boardIcons";
import { Icon } from "../components/icons";
import { norm } from "../lib/format";
import { STAGE, PROJECT_STAGE } from "../lib/labels";
import { useRecordHref } from "../lib/useRecordHref";
import { opportunityPath } from "./routes";

interface Hit {
  key: string;
  label: string;
  sub: string;
  href: string;
}

/** Üst çubuktaki arama: kişi, firma, fırsat, proje. ⌘K / Ctrl+K ile odaklanır. Listeler ilk odakta yüklenir. */
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

  const { has } = useModules();
  const recordHref = useRecordHref();
  const people = usePeople(armed && has("people"));
  const opps = useOpps(armed && has("pipeline"));
  const projects = useProjects(armed && has("projects"));

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

  const hits = useMemo<Hit[]>(() => {
    if (!armed || !dq.trim()) return [];
    const n = norm(dq.trim());
    const out: Hit[] = [];
    for (const p of people.rows) {
      if (norm(p.name).includes(n) || norm(p.company_name).includes(n) || norm(p.email).includes(n) || norm(p.handle).includes(n))
        out.push({ key: `p${p.id}`, label: p.name, sub: p.company_name ?? "Kişi", href: recordHref("person", p.id) });
    }
    for (const o of opps.rows) {
      if (norm(o.title).includes(n) || norm(o.person_name).includes(n))
        out.push({ key: `o${o.id}`, label: o.title, sub: `Fırsat · ${STAGE[o.stage]} · ${o.person_name}`, href: opportunityPath(o.id) });
    }
    for (const p of projects.rows) {
      if (norm(p.name).includes(n) || norm(p.person_name).includes(n))
        out.push({ key: `r${p.id}`, label: p.name, sub: `Proje · ${PROJECT_STAGE[p.stage]}`, href: recordHref("project", p.id) });
    }
    return out.slice(0, 8);
  }, [armed, dq, people.rows, opps.rows, projects.rows, recordHref]);

  const go = (h: Hit) => {
    navigate(h.href);
    setQ("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className={board ? "relative flex-none" : "relative hidden flex-none desk:block"}>
      <label className={board ? "dash-search" : "flex h-control-height-md w-search-width items-center gap-3 rounded-lg border border-border-default bg-surface-inset px-5 text-text-secondary"}>
        {board ? <BoardIcon name="search" className="size-icon-btn" stroke={1.8} /> : <Icon name="search" className="size-icon-md" />}
        <input
          ref={input}
          type="search"
          placeholder={board ? "Kişi, şirket, proje ara" : "Kişi, firma, fırsat ara"}
          aria-label="Ara"
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
            blurTimer.current = setTimeout(() => setOpen(false), 120);
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
        {board ? <kbd className="dash-kbd">⌘K</kbd> : null}
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
