import { describe, expect, it } from "vitest";
import { chatLive, chatPresence, IDLE_CHAT_LIVE, oldestSuggestKeys } from "../src/lib/chatStore";

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

describe("chat live state", () => {
  it("goes back to idle when the chat window is gone", () => {
    chatLive.set({ ...IDLE_CHAT_LIVE, open: true, running: true, status: "yazıyor" });
    expect(chatLive.get().running).toBe(true);
    chatLive.set(IDLE_CHAT_LIVE);
    expect(chatLive.get()).toBe(IDLE_CHAT_LIVE);
  });

  it("tells the mascot whether a chat window exists", () => {
    const seen: boolean[] = [];
    const off = chatPresence.subscribe(() => seen.push(chatPresence.get()));
    chatPresence.set(true);
    chatPresence.set(true);
    chatPresence.set(false);
    off();
    expect(seen).toEqual([true, false]);
  });
});
