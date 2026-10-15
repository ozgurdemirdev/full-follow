/** A list read that must see every row (a person by id, the people of a company) */
export const ALL_ROWS = 100000;
/** Rows of each part of the person card */
export const CARD_TOUCHES_LIMIT = 200;
export const CARD_NOTES_LIMIT = 200;
export const CARD_REFERRALS_LIMIT = 200;
export const CARD_OPPORTUNITIES_LIMIT = 100;
export const CARD_PROJECTS_LIMIT = 100;
export const CARD_DRAFTS_LIMIT = 20;
/** Waiting drafts looked at for the chat card of a person */
export const CHAT_CARD_DRAFTS_LIMIT = 10;
/** Related rows `get` loads per relation on the person page */
export const RELATED_ROWS = 50;
/** Longest referral chain followed when checking a new introducer for a loop (a guard against a broken tree) */
export const REFERRAL_CHAIN_MAX = 1000;
/** A person added within this many days is "fresh" on the people screen (the web's FRESH_DAYS is the same number) */
export const FRESH_DAYS = 14;
/** Which person column holds the account of each channel (the channel filter of the people screen) */
export const CHANNEL_ACCOUNT = { linkedin: "linkedin", email: "email", telefon: "phone", instagram: "instagram" } as const;
/** People the touch queue returns when no limit is given */
export const TOUCH_QUEUE_DEFAULT = 4;
