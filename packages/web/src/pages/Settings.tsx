import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { settingsPath } from "../app/routes";
import { Page } from "../app/Page";
import { Icon } from "../components/icons";
import { norm } from "../lib/format";
import { SETTINGS, SETTINGS_SEARCH_DEBOUNCE, type SettingsCard } from "./settings/registry";

const matches = (c: SettingsCard, q: string) => norm([c.title, ...c.keywords].join(" ")).includes(q);
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

/** Settings shell: search, category rail, and the cards of the active category (or of every match while searching) */
export default function Settings() {
  const { kategori } = useParams<{ kategori?: string }>();
  const [, navigate] = useLocation();
  const [input, setInput] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const q = norm(input.trim());
  const category = SETTINGS.find((c) => c.slug === kategori);

  useEffect(() => {
    if (!category) navigate(settingsPath(SETTINGS[0].slug), { replace: true });
  }, [category, navigate]);

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

  // after the query settles, fields whose label matches flash once
  useEffect(() => {
    if (!q) return;
    const id = setTimeout(() => {
      content.current?.querySelectorAll<HTMLElement>("[data-setting]").forEach((el) => {
        if (!norm(el.dataset.setting).includes(q)) return;
        el.classList.remove("set-hit");
        void el.offsetWidth;
        el.classList.add("set-hit");
        el.addEventListener("animationend", () => el.classList.remove("set-hit"), { once: true });
      });
    }, SETTINGS_SEARCH_DEBOUNCE);
    return () => clearTimeout(id);
  }, [q]);

  const active = category ?? SETTINGS[0];
  const found = q ? SETTINGS.map((c) => ({ ...c, cards: c.cards.filter((card) => matches(card, q)) })).filter((c) => c.cards.length) : null;
  const clear = () => {
    setInput("");
    search.current?.focus();
  };

  const cards = (list: SettingsCard[]) => list.map((c) => <div key={c.id} className="contents">{c.render()}</div>);

  return (
    <Page title="Ayarlar" sub="Kategori seç ya da ara" width="narrow" className="flex flex-col gap-7">
      <div className="set-search">
        <Icon name="search" className="size-icon-md" />
        <input
          ref={search}
          type="search"
          className="inp"
          placeholder="Ayarlarda ara: vergi, takip, maskot, etiket…"
          aria-label="Ayarlarda ara"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && input && (e.stopPropagation(), clear())}
        />
        <kbd>/</kbd>
      </div>
      <div className="set-layout">
        <nav className="set-rail" aria-label="Ayar kategorileri">
          {SETTINGS.map((c) => {
            const count = found ? (found.find((f) => f.slug === c.slug)?.cards.length ?? 0) : c.cards.length;
            return (
              <button
                key={c.slug}
                type="button"
                className="set-cat"
                aria-current={!found && c.slug === active.slug ? "true" : undefined}
                onClick={() => {
                  setInput("");
                  navigate(settingsPath(c.slug));
                }}
              >
                {c.name}
                <small>{count}</small>
              </button>
            );
          })}
        </nav>
        <div className="set-content" ref={content} aria-live="polite">
          {found ? (
            found.length ? (
              found.map((c) => (
                <div key={c.slug} className="flex flex-col gap-5">
                  <span className="set-group">{c.name}</span>
                  {cards(c.cards)}
                </div>
              ))
            ) : (
              <div className="set-empty">
                <span>“{input.trim()}” için ayar bulunamadı</span>
                <button type="button" className="btn btn-sec" onClick={clear}>Aramayı temizle</button>
              </div>
            )
          ) : (
            cards(active.cards)
          )}
        </div>
      </div>
    </Page>
  );
}
