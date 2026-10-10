import { createCore, openDb, type Core } from "@fullfollow/core";

export const CORE = Symbol("CORE");
export const FOLLOWUPS = Symbol("FOLLOWUPS");
export type { Core };

/** Otomatik takip taslakları: Claude adına hazırlanır, onay yine Özgür'de */
export interface AutoFollowups {
  run(): ReturnType<Core["followups"]["generate"]>;
}

let shared: { core: Core; auto: AutoFollowups } | null = null;

/**
 * Tek veritabanı bağlantısı. Web her işlemi actor = "ozgur" ile yapar.
 * Takip dizisi taslakları zamanlayıcıyla (açılışta ve saatte bir) actor = "claude" olarak yazılır:
 * bunlar "Claude taslağı"dır, girdiden gelen bir kimlik değildir. FF_AUTO_FOLLOWUP=0 kapatır.
 */
function init() {
  if (shared) return shared;
  const handle = openDb();
  const core = createCore(handle, "ozgur");
  const claude = createCore(handle, "claude");
  const auto: AutoFollowups = { run: () => claude.followups.generate() };
  if (process.env.FF_AUTO_FOLLOWUP !== "0") {
    const tick = () => {
      try {
        const r = auto.run();
        if (r.created.length) console.log(`  Takip taslağı hazırlandı: ${r.effects.join(", ")}`);
      } catch (e: any) {
        console.warn("  Takip taslakları hazırlanamadı:", e?.message ?? e);
      }
    };
    setTimeout(tick, 3000).unref();
    setInterval(tick, 60 * 60 * 1000).unref();
  }
  shared = { core, auto };
  return shared;
}

export const coreProvider = { provide: CORE, useFactory: (): Core => init().core };
export const followupsProvider = { provide: FOLLOWUPS, useFactory: (): AutoFollowups => init().auto };
