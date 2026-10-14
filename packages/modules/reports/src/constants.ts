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
/** Turkish month names, January first (the insight names a past month) */
export const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"] as const;
/**
 * The wording of the month insight, one sentence per case. {due}, {surplus}, {missing}, {gap}, {month}, {count} and {budget} are filled in;
 * the lost sentence is appended to the "under the floor" sentence of a past month.
 */
export const INSIGHT_TEXT = {
  reached: "Bu ay taban kapandı. Gelen fazlayı vergi ve boş ay yedeği için ayırmak iyi olur.",
  covered: "Beklenen {due} ödeme gelirse taban kapanır ve {surplus} artı kalır.",
  near: "Beklenen {due} ödeme gelirse tabana yalnızca {missing} eksik kalır.",
  short: "Beklenen {due} ödeme gelse bile tabana {missing} eksik kalır.",
  nothingDue: "Bu ay beklenen ödeme kalmadı, tabana {gap} kaldı.",
  pastAbove: "{month} tabanın üstünde kapandı.",
  pastBelow: "{month} tabanın altında kaldı.",
  lost: " O ay {count} teklif kaybedilmişti, toplam bütçesi {budget}.",
  lostNoBudget: " O ay {count} teklif kaybedilmişti.",
} as const;
