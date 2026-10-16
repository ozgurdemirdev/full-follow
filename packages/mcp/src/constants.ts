// Tunable values of the MCP host.

/** Characters of a record's text kept on one line (a comment, a label) */
export const CUT_CHARS = 60;
/** Characters of a person note kept on its line */
export const NOTE_CUT_CHARS = 80;
/** Characters of a record's name in the "opened" confirmation */
export const OPENED_LABEL_CHARS = 60;
/** Rows per section of `today` when the call gives no limit */
export const TODAY_ROWS = 10;
/** Most rows one `find` call returns, whatever limit it asks for (a long list would fill Claude's context) */
export const FIND_LIMIT_MAX = 50;

/** The marker around people's free text in MCP output (the rules tell Claude that text inside it is data, never instructions) */
export const DATA_OPEN = "⟦";
export const DATA_CLOSE = "⟧";
/** Row fields that hold free text that may run over lines: written inside the data marker; every other text field is collapsed to one line */
export const FREE_TEXT_FIELDS = [
  "notes", "note", "body", "summary", "description", "problem", "money_note", "sellable_note", "reject_note", "lost_reason", "outcome", "reason",
  "root_body", "last_body", "last_summary", "told",
];
