/** Sizes the UI formats; not design tokens */
export const CHAT_UI = {
  /** how close to the bottom still counts as "at the bottom" (CSS px) */
  stickPx: 80,
  /** connection badge waits this long before it shows */
  lostBadgeMs: 2_000,
  /** "back" banner stays this long */
  backBannerMs: 2_000,
  /** a navigate event older than this is a replay (F5), not a request */
  navigateMaxAgeMs: 5_000,
  /** after navigating, how long and how often to look for the opened row */
  flashPollMs: 100,
  flashTries: 30,
  warnLimit: 0.75,
  dangerLimit: 0.95,
  composerCountFrom: 0.8,
  /** list refresh while a reply may be finishing */
  contextUnit: 1_000,
  million: 1_000_000,
} as const;

/** How long a template card keeps saying "Kopyalandı" after the copy button (ms) */
export const COPIED_FEEDBACK_MS = 1_600;

/** Record blocks (the chips under a reply) whose rows are kept so scrolling back does not fetch again; the oldest go first */
export const RECORD_BLOCKS_KEPT = 60;
