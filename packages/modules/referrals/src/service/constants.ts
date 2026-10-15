/** A won opportunity of a referred person counts as "recent" for the thank-you list up to this many days after it closed */
export const THANKS_RECENT_DAYS = 30;
/** A delivered project is asked for a referral up to this many days after delivery; later it is no longer the moment */
export const ASK_RECENT_DAYS = 120;
/** Rows of each suggestion list */
export const SUGGESTIONS_SHOWN = 5;
/** Project stages that mean the work is handed over */
export const DELIVERED_STAGES: readonly string[] = ["teslim", "bakim"];
/** Payment status of a payment past its due date */
export const LATE_PAYMENT = "gecikmis";
/** Lists of other modules are read whole */
export const ALL_ROWS = 100_000;
/** Length of an ISO date (YYYY-MM-DD) cut from a timestamp */
export const ISO_DATE_LENGTH = 10;
