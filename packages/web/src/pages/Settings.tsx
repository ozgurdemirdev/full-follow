import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { settingsPath } from "../app/routes";
import { Page } from "../app/Page";
import { BoardIcon } from "../components/boardIcons";
import { CatIcon, SetSection } from "../components/settings/Parts";
import { norm } from "../lib/format";
import { rowMatches } from "../lib/settings";
import { settings } from "../messages.settings";
import { useSettingCategories } from "./settings/registry";
import { stroke as STROKE } from "../styles/tokens.json";

/** Links to the first versions of the categories keep working */
const m = settings.page;
const LEGACY_SLUG: Record<string, string> = { is: "isletme", network: "takip", listeler: "liste" };

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

/** Settings: search with hit counts, category list on the left, the cards of the active category (or of every match while searching) */
export default function Settings() {
  const { kategori } = useParams<{ kategori?: string }>();
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const categories = useSettingCategories();
  const q = norm(input.trim());
  const slug = LEGACY_SLUG[kategori ?? ""] ?? kategori;
  const active = categories.find((c) => c.slug === slug);

  useEffect(() => {
    if (!active) navigate(settingsPath(categories[0].slug), { replace: true });
  }, [active, categories, navigate]);

  // "/" focuses the search unless the user is typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      e.preventDefault();
      search.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // while searching: every category with its matching rows
  const found = useMemo(
    () => categories.map((c) => ({ c, rows: q ? c.rows.filter((r) => rowMatches(c, r, q)) : c.rows })),
    [categories, q],
  );
  const groups = q ? found.filter((g) => g.rows.length) : found.filter((g) => g.c.slug === (active ?? categories[0]).slug);

  return (
    <Page
      title={m.title}
      sub={m.sub}
      className=""
      right={(
        <label className="set-search">
          <BoardIcon name="search" className="size-icon-md" stroke={STROKE.thin} />
          <span className="sr-only">{m.search}</span>
          <input
            ref={search}
            type="search"
            placeholder={m.searchPlaceholder}
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && input && (e.stopPropagation(), setInput(""))}
          />
        </label>
      )}
    >
      <div className="set-grid">
        <nav aria-label={m.categories} className="set-cats">
          {found.map(({ c, rows }) => (
            <button
              key={c.slug}
              type="button"
              aria-current={!q && c.slug === (active ?? categories[0]).slug ? "page" : undefined}
              onClick={() => {
                setInput("");
                navigate(settingsPath(c.slug));
              }}
            >
              <CatIcon d={c.icon} />
              <span>{c.name}</span>
              {q && rows.length ? <small>{rows.length}</small> : null}
            </button>
          ))}
        </nav>
        <div className="set-groups">
          {groups.map(({ c, rows }) => <SetSection key={c.slug} name={c.name} sub={q ? undefined : c.sub} empty={c.empty} rows={rows} />)}
          {q && !groups.length ? <p className="set-nohits">{m.noHits(input.trim())}</p> : null}
        </div>
      </div>
    </Page>
  );
}
