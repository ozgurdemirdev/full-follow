import { quickAddSelector } from "@kit/lib/constants";

// Selectors of the quick add button and its menu: the mascot keeps clear of them, and finds them by the data attribute the kit puts on them
export const FAB_SELECTOR = quickAddSelector("fab");
export const FAB_MENU_SELECTOR = `${quickAddSelector("menu")}:not([aria-hidden="true"])`;
/** Delay of the boot callback where requestIdleCallback does not exist (ms) */
export const IDLE_FALLBACK_MS = 0;
