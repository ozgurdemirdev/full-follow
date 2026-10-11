// Chat state that must survive F5: open or not, large or not, open session, unsent drafts.
// localStorage can throw (private window), so every access is wrapped.
const KEY = { open: "ff.chat.open", large: "ff.chat.large", session: "ff.chat.session", draft: "ff.chat.draft." } as const;

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
  draft: (id: number | null) => read(`${KEY.draft}${id ?? "new"}`) ?? "",
  setDraft: (id: number | null, text: string) => write(`${KEY.draft}${id ?? "new"}`, text),
};
