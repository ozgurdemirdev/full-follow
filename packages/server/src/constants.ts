// Tunable values of the server host.

/** Port when FF_PORT is not set */
export const DEFAULT_PORT = 3000;
/** How long the probe waits when the port is busy and a running Full Follow may answer */
export const HEALTH_PROBE_TIMEOUT_MS = 1500;
/** How often the daily backup is checked while the server stays open */
export const BACKUP_CHECK_MS = 6 * 60 * 60 * 1000;

/** A session cookie lives this long */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** The generated cookie signing key (used when FF_COOKIE_SECRET is empty) and the session epoch, both beside the database */
export const SESSION_SECRET_FILE = "session.key";
export const SESSION_EPOCH_FILE = "session.epoch";
export const SESSION_SECRET_BYTES = 32;
/** Wrong logins from one address: this many within the window lock it for the window (every login, the right one too, is a 429) */
export const LOGIN_MAX_ATTEMPTS = 8;
export const LOGIN_WINDOW_MS = 60_000;
/** Each further lockout of one address doubles the lock, up to this */
export const LOGIN_LOCKOUT_MAX_MS = 60 * 60 * 1000;
/** How long an address's lockouts are remembered after its last lock ends (afterwards it starts again from one window) */
export const LOGIN_LOCKOUT_MEMORY_MS = 24 * 60 * 60 * 1000;
/** Addresses the login throttle remembers at most; past this the oldest are forgotten */
export const LOGIN_TRACKED_MAX = 10_000;
/** A password shorter than this draws a warning at start when the server listens beyond this computer */
export const MIN_PASSWORD_LENGTH = 12;

/** Rows of the "today" screen when the request gives no limit */
export const TODAY_ROWS_DEFAULT = 50;

/** Host names that always mean this computer (a Host header outside this list, the machine's own addresses and FF_ALLOWED_HOSTS is refused) */
export const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
/** Listen addresses that keep the server on this computer; any other FF_HOST needs FF_PASSWORD */
export const LOOPBACK_HOSTS = ["127.0.0.1", "localhost", "::1"];
/** Methods that change nothing: they pass the request guard without a declared body type */
export const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
/** Sec-Fetch-Site values a data changing request may carry: the panel itself, or the user typing the address ("same-site" is another port of this host) */
export const SAFE_FETCH_SITES = ["same-origin", "none"];
/** Body types a data changing request may declare (a form or text body is how another site would send one without a preflight) */
export const ALLOWED_BODY_TYPES = ["application/json", "multipart/form-data"];

/** Content-Security-Policy of the panel and every API answer: only this server's own files; images also from data: and blob: (previews, the mascot's textures) */
export const APP_CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
  "media-src 'self' blob:", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join("; ");
/** The Swagger UI page and its files: the same, except that Swagger UI writes inline styles */
export const DOCS_PATH = "/api/docs";
export const DOCS_CSP = APP_CSP.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
