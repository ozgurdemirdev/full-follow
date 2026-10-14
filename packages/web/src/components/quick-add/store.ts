// Open state of the quick add menu, shared by the header button, the floating button and the N shortcut
import { useSyncExternalStore } from "react";

export type QuickHost = "header" | "fab";

interface State {
  open: boolean;
  host: QuickHost;
  /** header buttons on screen (the dashboard has one): N opens that one, the floating button hides on desktop */
  headers: number;
}
let state: State = { open: false, host: "fab", headers: 0 };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => (subs.add(fn), () => void subs.delete(fn));

export const useQuickOpen = (host: QuickHost) => useSyncExternalStore(subscribe, () => state.open && state.host === host);
export const useHeaderMounted = () => useSyncExternalStore(subscribe, () => state.headers > 0);

export const closeQuick = () => state.open && set({ open: false });
export const toggleQuick = (host: QuickHost) => set({ open: !(state.open && state.host === host), host });
/** The N shortcut: the header button when the page has one */
export const openQuick = () => set({ open: true, host: state.headers > 0 ? "header" : "fab" });

/** A page header with the button registers itself while mounted; returns the cleanup */
export function registerHeader() {
  set({ headers: state.headers + 1 });
  return () => set({ headers: state.headers - 1 });
}
