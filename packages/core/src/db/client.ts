import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { backfillKeys } from "../keys";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Q = Db | Tx;

export interface DbHandle {
  db: Db;
  sqlite: Database.Database;
  close(): void;
}

/** packages/core klasörü (src/db ya da dist/db'nin iki üstü) */
const CORE_ROOT = path.resolve(__dirname, "../..");

/** Repo kökündeki .env dosyasını (varsa) process.env'e yükler; zaten tanımlı değişkenlere dokunmaz */
export function loadRootEnv(): void {
  try {
    process.loadEnvFile(path.resolve(CORE_ROOT, "../../.env"));
  } catch {
    /* .env yoksa sorun değil */
  }
}

export const MIGRATIONS_DIR = path.join(CORE_ROOT, "src", "db", "migrations");

/** Varsayılan veritabanı: <repo>/data/fullfollow.db, FF_DB ile değiştirilir */
export function defaultDbPath(): string {
  return process.env.FF_DB ? path.resolve(process.env.FF_DB) : path.resolve(CORE_ROOT, "../../data/fullfollow.db");
}

/** Veritabanını açar (WAL, foreign key açık) ve bekleyen migration'ları uygular. ":memory:" desteklenir. */
export function openDb(file: string = defaultDbPath()): DbHandle {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  // Tablo yeniden kuran migration'lar (DROP + RENAME) foreign key kapalıyken çalışır; SQLite'ın önerdiği sıra:
  // kapat, uygula, foreign_key_check ile doğrula, aç. Pragma transaction içinde etkisiz olduğu için burada.
  sqlite.pragma("foreign_keys = OFF");
  try {
    const applied = () => {
      try {
        return (sqlite.prepare("SELECT COUNT(*) n FROM __drizzle_migrations").get() as { n: number }).n;
      } catch {
        return 0;
      }
    };
    const before = applied();
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    const broken = applied() !== before ? (sqlite.pragma("foreign_key_check") as unknown[]) : [];
    if (broken.length) throw new Error(`migration sonrası ${broken.length} kırık foreign key: ${JSON.stringify(broken.slice(0, 3))}`);
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  backfillKeys(sqlite);
  return { db, sqlite, close: () => sqlite.close() };
}

/**
 * Günlük yedek: <db klasörü>/backups/fullfollow-YYYY-MM-DD.db. Bugünün yedeği varsa atlar,
 * en yeni `keep` yedeği tutar. SQLite'ın çevrimiçi yedeği kullanılır (sunucu açıkken güvenli).
 */
export async function backupDb(file: string = defaultDbPath(), keep = 14): Promise<string | null> {
  if (file === ":memory:" || !fs.existsSync(file)) return null;
  const dir = path.join(path.dirname(file), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(file, path.extname(file));
  const day = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD, yerel saat
  const dest = path.join(dir, `${base}-${day}.db`);
  if (fs.existsSync(dest)) return null;
  const src = new Database(file, { readonly: true, fileMustExist: true });
  try {
    await src.backup(dest);
  } finally {
    src.close();
  }
  const old = fs.readdirSync(dir).filter((f) => f.startsWith(`${base}-`) && f.endsWith(".db")).sort();
  for (const f of old.slice(0, Math.max(0, old.length - keep))) fs.rmSync(path.join(dir, f));
  return dest;
}
