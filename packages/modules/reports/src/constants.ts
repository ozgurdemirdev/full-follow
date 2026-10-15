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

/** The month insight: when the due payments leave the floor short by at most this share of it, the sentence says "only a little short" */
export const INSIGHT_NEAR_SHARE = 0.1;
/** Days the marketing report's channel line looks back (kept next to its default in the channel performance) */
export const CHANNEL_PERFORMANCE_DAYS = 30;
/** MCP output: referrals named in the report, and the longest template name in the review */
export const MCP_REFERRALS = 5;
export const MCP_TEMPLATE_NAME_LENGTH = 25;
