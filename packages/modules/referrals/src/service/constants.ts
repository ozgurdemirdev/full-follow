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
export const WHOLE = 100_000;

/** What Claude is asked for: the task a request creates has this title, and the row is "asked" while that task is open */
export const REQUEST_TITLE = {
  thanks: (name: string) => `${name} için teşekkür mesajı taslağı hazırla`,
  ask: (name: string) => `${name} için referans ricası taslağı hazırla`,
};

/** The sentence under a suggestion */
export const WHY = {
  thanks: (name: string, value: string | null) => `Tanıttığı ${name} kazanıldı${value ? ` · ${value}` : ""}`,
  askReady: (project: string, ago: string) => `${project} ${ago} teslim edildi, ödemesi tamam. Kimseyi tanıtmadı.`,
  askLate: (owed: string) => `Şimdi değil: ${owed} ödemesi gecikmede`,
  today: "bugün",
  daysAgo: (days: number) => `${days} gün önce`,
};

export const tl = (n: number) => `₺${n.toLocaleString("tr-TR")}`;
