import { useSyncExternalStore } from "react";

/** What a running reply is doing: waiting its turn, thinking, using a tool, writing */
export type ChatPhase = "queued" | "thinking" | "tool" | "writing";

// Chat state that must survive F5: open or not, large or not, open session, unsent drafts.
// localStorage can throw (private window), so every access is wrapped.
const KEY = { open: "ff.chat.open", large: "ff.chat.large", session: "ff.chat.session", draft: "ff.chat.draft.", suggest: "ff.chat.suggest." } as const;

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null || v === "") localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private window */
  }
};

export const chatPrefs = {
  open: () => read(KEY.open) === "1",
  setOpen: (v: boolean) => write(KEY.open, v ? "1" : null),
  large: () => read(KEY.large) === "1",
  setLarge: (v: boolean) => write(KEY.large, v ? "1" : null),
  session: () => {
    const n = Number(read(KEY.session));
    return Number.isInteger(n) && n > 0 ? n : null;
  },
  setSession: (id: number | null) => write(KEY.session, id === null ? null : String(id)),
  /** what Özgür did with a suggestion button: "done" or "no" (kept per reply so F5 does not bring the buttons back) */
  suggest: (messageId: number) => read(`${KEY.suggest}${messageId}`),
  setSuggest: (messageId: number, v: "done" | "no") => write(`${KEY.suggest}${messageId}`, v),
  draft: (id: number | null) => read(`${KEY.draft}${id ?? "new"}`) ?? "",
  setDraft: (id: number | null, text: string) => write(`${KEY.draft}${id ?? "new"}`, text),
};

/** Anything outside the chat window (the mascot) asks it to open here; it never asks to close */
export const chatBus = new EventTarget();
export const requestChatOpen = () => chatBus.dispatchEvent(new Event("open"));

/** What the mascot needs to know about the chat: window open, a reply running (and its status), a finished reply nobody has seen */
export interface ChatLive {
  open: boolean;
  running: boolean;
  ready: boolean;
  /** status text and start time of the running reply, for the pill next to the mascot */
  status: string | null;
  since: number | null;
  /** phase and tool of the running reply, for the mascot's acting (tool names arrive without the mcp__full-follow__ prefix) */
  phase: ChatPhase | null;
  tool: string | null;
  /** the last reply that ended: `n` counts them, `error` is true when it failed (stopped replies do not count) */
  outcome: { n: number; error: boolean } | null;
}
let liveState: ChatLive = { open: false, running: false, ready: false, status: null, since: null, phase: null, tool: null, outcome: null };
const liveSubs = new Set<() => void>();
export const chatLive = {
  get: () => liveState,
  subscribe: (fn: () => void) => (liveSubs.add(fn), () => void liveSubs.delete(fn)),
  set: (next: ChatLive) => {
    if (Object.keys(next).every((k) => next[k as keyof ChatLive] === liveState[k as keyof ChatLive])) return;
    liveState = next;
    liveSubs.forEach((fn) => fn());
  },
};
export const useChatLive = () => useSyncExternalStore(chatLive.subscribe, chatLive.get);

/** Something other than the chat's own button opens the chat (the mascot, while it is drawn): the button steps aside. Whatever fills that role reports here and clears it when it goes away */
let openerPresent = false;
const openerSubs = new Set<() => void>();
export const setChatOpener = (present: boolean) => {
  if (present === openerPresent) return;
  openerPresent = present;
  openerSubs.forEach((fn) => fn());
};
export const useChatOpener = () => useSyncExternalStore((fn) => (openerSubs.add(fn), () => void openerSubs.delete(fn)), () => openerPresent);
