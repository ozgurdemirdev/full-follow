// Tunable values of the server host.

/** Port when FF_PORT is not set */
export const DEFAULT_PORT = 3000;
/** How long the probe waits when the port is busy and a running Full Follow may answer */
export const HEALTH_PROBE_TIMEOUT_MS = 1500;
/** How often the daily backup is checked while the server stays open */
export const BACKUP_CHECK_MS = 6 * 60 * 60 * 1000;

/** A session cookie lives this long */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Wrong or repeated logins from one address: this many within the window are refused until it ends */
export const LOGIN_MAX_ATTEMPTS = 8;
export const LOGIN_WINDOW_MS = 60_000;

/** Rows of the "today" screen when the request gives no limit */
export const TODAY_ROWS_DEFAULT = 50;

/** Host names that always mean this computer (a Host header outside this list, the machine's own addresses and FF_ALLOWED_HOSTS is refused) */
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
/** Methods that change nothing: they pass the request guard without a declared body type */
export const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
/** Body types a data changing request may declare (a form or text body is how another site would send one without a preflight) */
export const ALLOWED_BODY_TYPES = ["application/json", "multipart/form-data"];
