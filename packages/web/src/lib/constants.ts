// Tunable values the kit's screens share, each written once.

/** A list or popover closes this long after its field loses focus, so a click on one of its rows still lands */
export const BLUR_CLOSE_MS = 120;
/** Hits the top bar search lists */
export const SEARCH_HITS = 8;
/** Rows one page of an endless list asks for (people, companies) */
export const LIST_PAGE = 40;
/** Rows one request of a list that is read whole (open tasks, the pipeline board, comments ...) asks for */
export const DRAIN_PAGE = 200;
/** Rows a picker (person, company, opportunity, project) asks the server for */
export const PICKER_HITS = 8;
/** A request that only reads the `total` of a list asks for this many rows */
export const ONE_ROW = 1;
/** Opportunities of one person a form offers to tie a touch to */
export const PERSON_OPPS_LIMIT = 50;
/** Rows each source of the top bar search asks for */
export const SEARCH_SOURCE_HITS = 5;
/** A typed search waits this long after the last key before it asks the server */
export const SEARCH_DEBOUNCE_MS = 200;
/** An endless list starts the next page when its end is this close to the window (px) */
export const LOAD_MORE_MARGIN_PX = 600;

/** The attribute the floating quick add button and the open quick add menu carry, so the mascot can keep clear of them without knowing their labels */
export const QUICK_ADD_ATTR = "data-quick-add";
export type QuickAddPart = "fab" | "menu";
/** Props that mark an element as a part of quick add */
export const quickAddMark = (part: QuickAddPart) => ({ [QUICK_ADD_ATTR]: part });
/** CSS selector of a part of quick add */
export const quickAddSelector = (part: QuickAddPart) => `[${QUICK_ADD_ATTR}="${part}"]`;

/** Reply suggestion answers (`ff.chat.suggest.<id>`) kept in this browser; the oldest go first */
export const SUGGEST_KEEP = 200;
