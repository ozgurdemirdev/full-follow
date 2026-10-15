/** Words that name the draft record type in the generic tools */
export const DRAFT_ALIASES = ["taslak"];
/** Highest follow-up step a draft can carry */
export const FOLLOWUP_STEP_MAX = 10;
/** Longest draft text written into an event summary: most events, the reject note and the trash title */
export const EVENT_TEXT_LENGTH = 50;
export const EVENT_NOTE_LENGTH = 60;
/** MCP output: longest draft text and reject note on a draft line */
export const MCP_BODY_LENGTH = 60;
export const MCP_NOTE_LENGTH = 40;
/** The longest email subject line of a draft */
export const DRAFT_SUBJECT_MAX = 200;

/** The note the web sends when Özgür rejects without giving a reason (the reject call needs one): it is kept on the draft but never becomes a learned rule */
export const REJECT_NO_REASON_NOTE = "Neden yazılmadı";
