import { createApp, type App } from "@fullfollow/app";
import { APP_TOKEN, CLAUDE_APP_TOKEN, openDb } from "@fullfollow/core";

/** The composed app is injected under core's string token, so module packages can ask for it without importing the server */
export const CORE = APP_TOKEN;
/** The composed app (core plus installed modules); controllers inject it under the CORE token. */
export type Core = App;

let shared: { core: Core; claude: Core } | null = null;

/**
 * Tek veritabanı bağlantısı. Web her işlemi actor = "owner" ile yapar; `claude` aynı uygulamanın actor = "claude" ile olanıdır:
 * zamanlanmış işler (modüllerin `jobs` katkısı, örneğin takip dizisi taslakları) ve Claude adına yazan modül uçları onu kullanır.
 */
function init() {
  if (shared) return shared;
  const handle = openDb();
  shared = { core: createApp(handle, "owner"), claude: createApp(handle, "claude") };
  return shared;
}

export const coreProvider = { provide: CORE, useFactory: (): Core => init().core };
/** The app as Claude, for scheduled jobs and the modules that write on Claude's behalf (the "run follow-ups now" button) */
export const claudeProvider = { provide: CLAUDE_APP_TOKEN, useFactory: (): Core => init().claude };
