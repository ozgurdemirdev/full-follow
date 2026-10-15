import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { run } from "../api/actions";
import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { PriceFloor, Today } from "../api/types";
import { norm } from "./format";

/** A field saves this long after the last change, one request per pause */
export const SETTINGS_SAVE_DEBOUNCE = 700;
/** A list longer than this shows a "N more" button instead of every row */
export const SETTINGS_ROW_LIMIT = 12;
/** The search keywords of a row, written in the messages as one comma separated string */
export const words = (list: string) => list.split(",");
const SAVED_TOAST = "Kaydedildi";

export interface SettingRow {
  /** stable: React key */
  id: string;
  name: string;
  hint?: string;
  /** extra words the search matches */
  keywords?: string[];
  /** the control sits under the name (editors, chip lists) instead of at the right */
  wide?: boolean;
  control: ReactNode;
}

export interface SettingCategory {
  slug: string;
  name: string;
  /** svg path data of the nav icon */
  icon: string;
  sub?: string;
  /** shown when the category has no rows at all */
  empty?: string;
  rows: SettingRow[];
}

/** The board's search: row name, hint and category name, Turkish letters folded */
export const rowMatches = (c: SettingCategory, r: SettingRow, q: string) => norm([r.name, r.hint, c.name, ...(r.keywords ?? [])].join(" ")).includes(q);

/** GET /settings (shared cache entry; one request for every row) */
export function useSettings() {
  return useQuery<PriceFloor>(K.settings);
}

/** The network settings (inside the dashboard payload, same cache entry); undefined while loading or when the module is absent */
export function useNetworkCfg() {
  const t = useQuery<Today>(K.today);
  return { cfg: t.data?.network?.settings, loading: t.loading, reload: t.reload };
}

/** PUT /settings with the "Kaydedildi" toast */
export const putSettings = (body: Record<string, unknown>, ok = SAVED_TOAST) => run("put", "/settings", body, { ok });

/**
 * A field that saves itself: shows the local draft while it is being edited, sends one request after a pause
 * (and at once when the field goes away), then falls back to the server value once it has been reloaded.
 * A failed save drops the draft, so the field shows what the server has.
 */
export function useAutosave<T>(server: T, save: (value: T) => Promise<unknown>, settle: () => Promise<unknown>): [T, (value: T) => void] {
  const [draft, setDraft] = useState<{ v: T } | null>(null);
  const pending = useRef<{ v: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ server, save, settle });
  useEffect(() => {
    latest.current = { server, save, settle };
  });

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const { server: now, save: send, settle: reload } = latest.current;
    const done = () => {
      if (!pending.current) setDraft(null);
    };
    if (Object.is(p.v, now)) return done();
    send(p.v).then(reload).then(done, done);
  }, []);
  useEffect(() => flush, [flush]);

  const change = useCallback(
    (value: T) => {
      pending.current = { v: value };
      setDraft({ v: value });
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SETTINGS_SAVE_DEBOUNCE);
    },
    [flush],
  );
  return [draft ? draft.v : server, change];
}
