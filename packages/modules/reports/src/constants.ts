/** The weekly target counts as missed when fewer messages than this share of it went out (missed by more than a quarter) */
export const REVIEW_TARGET_MISS_SHARE = 0.75;
/** A lowered weekly target suggestion rounds the week's pace up to a multiple of this */
export const REVIEW_TARGET_STEP = 5;
/** A channel that hit its daily limit on at least this many days of the week is "mostly full" */
export const REVIEW_LIMIT_DAYS = 3;
export const REVIEW_MIN_SUGGESTIONS = 2;
export const REVIEW_MAX_SUGGESTIONS = 4;
/** The review is announced on the dashboard on this ISO weekday (5 = Friday); an unfinished week's target is judged from then on */
export const REVIEW_WEEKDAY = 5;
export const WEEK_DAYS = 7;
/** How many months the month chart shows when the request does not say */
export const REPORT_MONTHS_DEFAULT = 6;
