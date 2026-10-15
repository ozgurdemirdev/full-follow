import { describe, expect, it } from "vitest";
import { oldestSuggestKeys } from "../src/lib/chatStore";

const key = (id: number) => `ff.chat.suggest.${id}`;

describe("suggestion answers kept in the browser", () => {
  it("drops the oldest replies first and keeps the newest", () => {
    const keys = [key(40), key(7), key(300), key(12), key(5)];
    expect(oldestSuggestKeys(keys, 3).sort()).toEqual([key(5), key(7)].sort());
  });

  it("drops nothing while under the maximum", () => {
    expect(oldestSuggestKeys([key(1), key(2)], 2)).toEqual([]);
    expect(oldestSuggestKeys([], 5)).toEqual([]);
  });
});
