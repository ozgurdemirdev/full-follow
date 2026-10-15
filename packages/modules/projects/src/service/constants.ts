/** Words that name the project and payment record types in the generic tools */
export const PROJECT_ALIASES = ["proje"];
export const PAYMENT_ALIASES = ["odeme", "ödeme"];
/** Days ahead the payments of the Today view and the MCP "Ödeme" section look */
export const PAYMENTS_DUE_DAYS = 7;
/** Rows of a record's relations that its detail endpoint loads */
export const DETAIL_RELATED_LIMIT = 50;
/** MCP output: the longest task title on a project line */
export const MCP_TASK_LENGTH = 40;
/** The stage of a cancelled project: the money still unpaid on it is not due, not overdue and not waited for */
export const CANCELLED_STAGE = "iptal";
/** SQL for "the project (alias `pr`) is not cancelled": every due, overdue and unpaid figure takes its payments through this one condition */
export const NOT_CANCELLED = `pr.stage <> '${CANCELLED_STAGE}'`;
