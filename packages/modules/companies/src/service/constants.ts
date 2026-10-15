/**
 * Tag slugs that make a company a partner. `ajans` is not one of them: most companies tagged Ajans are prospects, not partners
 * (the rule is pending Özgür's answer; adding "ajans" here is the whole change).
 */
export const PARTNER_TAGS: readonly string[] = ["is_ortagi"];

/** A list read that must see every row (a company by id, the opportunities of one company) */
export const ALL_ROWS = 100000;
/** Rows of each part of the company card */
export const CARD_PEOPLE_LIMIT = 500;
export const CARD_TOUCHES_LIMIT = 200;
export const CARD_DRAFTS_LIMIT = 50;
/** Related rows `get` loads per relation on the company page */
export const RELATED_ROWS = 50;
