import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { run } from "../api/actions";
import { COST_FIELDS, floorOf, SAVE_DELAY_MS, type CostKey, type Costs } from "./report";

type Draft = Partial<Costs>;

/**
 * The cost inputs of the floor card: typed values show (and recompute the floor) at once, one PUT /settings goes out
 * per pause in typing with everything changed so far. A draft value is dropped once the server shows it, or when the save fails.
 */
export function useFloorCosts(server: Costs | undefined) {
  const [draft, setDraft] = useState<Draft>({});
  /** values typed but not sent yet (read by the timer and by the unmount flush) */
  const unsent = useRef<Draft>({});

  const costs = useMemo(() => (server ? { ...server, ...draft } : undefined), [server, draft]);

  const save = useCallback(() => {
    const body = unsent.current;
    unsent.current = {};
    if (!Object.keys(body).length) return;
    run("put", "/settings", body, { ok: "Kaydedildi" }).catch(() => setDraft((d) => omit(d, Object.keys(body) as CostKey[])));
  }, []);

  const set = useCallback((key: CostKey, value: number | null) => {
    const v = value ?? 0;
    unsent.current = { ...unsent.current, [key]: v };
    setDraft((d) => ({ ...d, [key]: v }));
  }, []);

  useEffect(() => {
    if (!Object.keys(draft).length) return;
    const t = window.setTimeout(save, SAVE_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [draft, save]);

  // leaving the page inside the pause must not lose the typed values
  useEffect(() => save, [save]);

  // the server now shows what was typed: the draft has done its job
  useEffect(() => {
    if (!server) return;
    setDraft((d) => {
      const same = COST_FIELDS.filter((f) => f.key in d && d[f.key] === server[f.key]).map((f) => f.key);
      return same.length ? omit(d, same) : d;
    });
  }, [server]);

  const { floor } = useMemo(() => (costs ? floorOf(costs) : { floor: 0 }), [costs]);
  return { costs, set, floor };
}

const omit = (d: Draft, keys: CostKey[]): Draft => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k as CostKey)));
