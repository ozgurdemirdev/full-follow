import { createApp, type App } from "@fullfollow/app";
import { APP_TOKEN, CLAUDE_APP_TOKEN, openDb } from "@fullfollow/core";

/** The composed app is injected under core's string token, so module packages can ask for it without importing the server */
export const CORE = APP_TOKEN;
/** The composed app (core plus installed modules); controllers inject it under the CORE token. */
export type Core = App;

let shared: { core: Core; claude: Core } | null = null;

/**
 * Tek veritabanı bağlantısı. Web her işlemi actor = "ozgur" ile yapar; `claude` aynı uygulamanın actor = "claude" ile olanıdır.
 * Takip dizisi taslakları (drafts modülü) zamanlayıcıyla (açılışta ve saatte bir) `claude` olarak yazılır:
 * bunlar "Claude taslağı"dır, girdiden gelen bir kimlik değildir. FF_AUTO_FOLLOWUP=0 kapatır; drafts modülü yoksa zamanlayıcı bir şey yapmaz.
 */
function init() {
  if (shared) return shared;
  const handle = openDb();
  const core = createApp(handle, "ozgur");
  const claude = createApp(handle, "claude");
  if (process.env.FF_AUTO_FOLLOWUP !== "0") {
    const tick = () => {
      try {
        const r = claude.mod("drafts")?.followups.generate();
        if (r?.created.length) console.log(`  Takip taslağı hazırlandı: ${r.effects.join(", ")}`);
      } catch (e) {
        console.warn("  Takip taslakları hazırlanamadı:", e instanceof Error ? e.message : e);
      }
    };
    setTimeout(tick, 3000).unref();
    setInterval(tick, 60 * 60 * 1000).unref();
  }
  shared = { core, claude };
  return shared;
}

export const coreProvider = { provide: CORE, useFactory: (): Core => init().core };
/** The app as Claude, for the modules that write on Claude's behalf (the "run follow-ups now" button) */
export const claudeProvider = { provide: CLAUDE_APP_TOKEN, useFactory: (): Core => init().claude };
