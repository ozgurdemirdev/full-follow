import type { CardRecord } from "./api";
import { RECORD_BLOCKS_KEPT } from "./constants";

/** The rows of each record block, by message and block: one request per block, kept so scrolling and re-renders do not fetch again */
export function createRecordCache(max: number) {
  const map = new Map<string, CardRecord[]>();
  return {
    get: (key: string) => map.get(key),
    has: (key: string) => map.has(key),
    set(key: string, rows: CardRecord[]) {
      map.delete(key);
      map.set(key, rows);
      // a Map keeps insertion order: the first key is the oldest
      for (const old of map.keys()) {
        if (map.size <= max) break;
        map.delete(old);
      }
    },
    clear: () => map.clear(),
    size: () => map.size,
  };
}

/** Cleared whenever the chat window opens or another session is shown, so the cards read fresh rows */
export const recordCache = createRecordCache(RECORD_BLOCKS_KEPT);
