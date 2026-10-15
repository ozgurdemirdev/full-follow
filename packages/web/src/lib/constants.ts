// Tunable values the kit's screens share, each written once.

/** A list or popover closes this long after its field loses focus, so a click on one of its rows still lands */
export const BLUR_CLOSE_MS = 120;
/** Links of one record the links card loads */
export const LINKS_LIMIT = 200;
/** Hits the top bar search lists */
export const SEARCH_HITS = 8;

/** The attribute the floating quick add button and the open quick add menu carry, so the mascot can keep clear of them without knowing their labels */
export const QUICK_ADD_ATTR = "data-quick-add";
export type QuickAddPart = "fab" | "menu";
/** Props that mark an element as a part of quick add */
export const quickAddMark = (part: QuickAddPart) => ({ [QUICK_ADD_ATTR]: part });
/** CSS selector of a part of quick add */
export const quickAddSelector = (part: QuickAddPart) => `[${QUICK_ADD_ATTR}="${part}"]`;

/** Reply suggestion answers (`ff.chat.suggest.<id>`) kept in this browser; the oldest go first */
export const SUGGEST_KEEP = 200;
