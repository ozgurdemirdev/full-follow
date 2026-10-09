import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
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
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db, sqlite, close: () => sqlite.close() };
}
