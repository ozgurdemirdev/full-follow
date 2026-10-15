/** Words that name the template record type in the generic tools */
export const TEMPLATE_ALIASES = ["sablon", "şablon", "templates"];

/** Longest template name written into an event summary */
export const EVENT_NAME_LENGTH = 60;
/** MCP output: templates named per comparison group, and the lengths of a template name in it and of the text on a template line */
export const MCP_GROUP_TEMPLATES = 3;
export const MCP_GROUP_NAME_LENGTH = 25;
export const MCP_BODY_LENGTH = 50;

/** A template with enough sends and a reply rate below this is flagged to be retired */
export const RETIRE_RATE = 0.15;

export const percent = (rate: number) => `%${Math.round(rate * 100)}`;
