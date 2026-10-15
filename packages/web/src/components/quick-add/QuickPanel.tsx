import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRegistry } from "../../app/modules/registry";
import type { QuickAddEntry } from "../../app/modules/types";
import type { SheetKind } from "../../app/ui";
import { quickAddMark } from "../../lib/constants";
import { useIsDesktop } from "../../lib/media";
import { norm } from "../../lib/format";
import { parts } from "../../messages.parts";
import { FORM_ICON, PathIcon } from "../forms/icons";
import type { QuickHost } from "./store";

const m = parts.quick;

/** An item matches by its name, its destination, or its letter */
const matches = (it: QuickAddEntry, q: string) => !q || norm(`${it.name} ${it.dest}`).includes(q) || norm(it.key) === q;

/**
 * The list of record types: search ("Ne eklemek istiyorsun?"), groups with a tinted tile, name, destination and letter.
 * ↑ ↓ Enter pick, a single letter opens its item while the search is empty, Esc is handled by the host.
 */
export function QuickPanel({ host, onPick }: { host: QuickHost; onPick: (kind: SheetKind) => void }) {
  const desk = useIsDesktop();
  const [text, setText] = useState("");
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const q = norm(text.trim());
  // the record types of the installed, visible modules
  const installed = useRegistry().quickGroups;
  const groups = useMemo(() => installed.map((g) => ({ ...g, items: g.items.filter((it) => matches(it, q)) })).filter((g) => g.items.length), [installed, q]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel, flat]);

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, Math.min(flat.length - 1, s + (e.key === "ArrowDown" ? 1 : -1))));
    } else if (e.key === "Enter" && flat[sel]) {
      e.preventDefault();
      onPick(flat[sel].kind);
    } else if (e.key.length === 1 && !text) {
      // the search is empty: a letter is a shortcut, not the start of a word
      const hit = installed.flatMap((g) => g.items).find((it) => it.key.toLowerCase() === e.key.toLowerCase());
      if (hit) {
        e.preventDefault();
        onPick(hit.kind);
      }
    }
  };

  let index = -1;
  return (
    <div className="quick-pop" role="menu" aria-label={m.title} data-host={host} {...quickAddMark("menu")} onKeyDown={key}>
      <span className="quick-grab" aria-hidden="true" />
      <div className="quick-search">
        <PathIcon d={FORM_ICON.search} className="size-icon-chip" />
        <input
          type="text"
          value={text}
          autoFocus={desk}
          placeholder={m.search}
          aria-label={m.searchAria}
          onChange={(e) => {
            setText(e.target.value);
            setSel(0);
          }}
        />
      </div>
      <div className="quick-list" ref={list}>
        {groups.map((g) => (
          <div key={g.name} className="quick-group">
            <span className="quick-group-name">{g.name}</span>
            <div className="quick-items">
              {g.items.map((it) => {
                const mine = ++index;
                return (
                  <button
                    key={it.kind}
                    type="button"
                    role="menuitem"
                    className="quick-item"
                    data-active={mine === sel}
                    onPointerEnter={() => setSel(mine)}
                    onClick={() => onPick(it.kind)}
                  >
                    <span className="quick-tile" data-tone={it.tone}>
                      <PathIcon d={it.icon} className="size-icon-md" />
                    </span>
                    <span className="quick-text">
                      <span className="quick-name">{it.name}</span>
                      <span className="quick-dest">{it.dest}</span>
                    </span>
                    <span className="quick-badge">{it.key}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {flat.length ? null : <p className="quick-empty">{m.none(text.trim())}</p>}
      </div>
      <div className="quick-foot">
        <span>{m.hintPick}</span>
        <span>{m.hintOpen}</span>
        <span>{m.hintLetter}</span>
        <span>{m.hintClose}</span>
      </div>
    </div>
  );
}
