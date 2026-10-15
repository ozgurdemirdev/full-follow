// Selectors of the quick add button and its menu: the mascot keeps clear of them, and finds them by the label the shell gives them
export const FAB_SELECTOR = 'button[aria-label="Hızlı ekle"]';
export const FAB_MENU_SELECTOR = '[role="menu"][aria-label="Hızlı ekle"]:not([aria-hidden="true"])';
/** Delay of the boot callback where requestIdleCallback does not exist (ms) */
export const IDLE_FALLBACK_MS = 0;
