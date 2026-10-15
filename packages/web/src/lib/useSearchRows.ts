import { useEffect, useState } from "react";
import { api, qs } from "../api/client";
import { endpointOn } from "../api/modules";
import type { List } from "../api/types";
import { SEARCH_DEBOUNCE_MS } from "./constants";
import { useDebounced } from "./useDebounced";

/** One list to ask: its path, how many rows, and any filters beside `q` */
export interface SearchPath {
  path: string;
  limit: number;
  params?: Record<string, string | number | boolean | undefined>;
}

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

/**
 * Asks the server for the rows of one or more lists that match typed text (`q`), instead of filtering a list held in the browser.
 * The text waits SEARCH_DEBOUNCE_MS after the last key, a request the next text makes useless is aborted, and nothing is asked while `enabled` is false
 * (so a closed search or picker holds no subscription and polls nothing). `rows[i]` answers `paths[i]`; the rows of the last answer stay until the next arrives.
 */
export function useSearchRows<T = unknown>(paths: readonly SearchPath[], text: string, enabled: boolean): T[][] {
  const typed = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  const wanted = enabled ? JSON.stringify([typed, paths]) : null;
  const [answer, setAnswer] = useState<T[][]>([]);
  useEffect(() => {
    if (!wanted) return;
    const [q, list] = JSON.parse(wanted) as [string, SearchPath[]];
    const abort = new AbortController();
    Promise.all(
      list.map((p) =>
        endpointOn(p.path)
          ? api.get<List<T>>(`${p.path}${qs({ ...p.params, q, limit: p.limit })}`, abort.signal).then((r) => r.rows)
          : Promise.resolve([] as T[]),
      ),
    ).then(
      (rows) => setAnswer(rows),
      (e: unknown) => {
        if (!isAbort(e)) setAnswer([]);
      },
    );
    return () => abort.abort();
  }, [wanted]);
  return enabled ? answer : [];
}
