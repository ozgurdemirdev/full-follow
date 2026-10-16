import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath } from "@fullfollow/core";
import { SESSION_EPOCH_FILE, SESSION_SECRET_BYTES, SESSION_SECRET_FILE } from "./constants";

/** Files beside the database: a throwaway FF_DB gets its own key and epoch */
const fileOf = (name: string) => path.join(path.dirname(defaultDbPath()), name);

const secrets = new Map<string, string>();
const epochs = new Map<string, number>();

/**
 * The key that signs session cookies: FF_COOKIE_SECRET, or random bytes generated once and kept in a file next to the database.
 * Mode 0600 keeps other local users out where the OS honours it; on Windows the folder ACL decides (see README, Güvenlik).
 */
export function sessionSecret(): string {
  if (process.env.FF_COOKIE_SECRET) return process.env.FF_COOKIE_SECRET;
  const file = fileOf(SESSION_SECRET_FILE);
  let s = secrets.get(file);
  if (s) return s;
  try {
    s = fs.readFileSync(file, "utf8").trim();
  } catch {
    s = "";
  }
  if (!s) {
    s = randomBytes(SESSION_SECRET_BYTES).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(file, s, { mode: 0o600, flag: "wx" });
    } catch {
      // another process wrote it first: its key wins so both sign alike
      s = fs.readFileSync(file, "utf8").trim();
    }
  }
  secrets.set(file, s);
  return s;
}

/** The session epoch: part of every signed cookie, so raising it ends every session given out before */
export function sessionEpoch(): number {
  const file = fileOf(SESSION_EPOCH_FILE);
  let e = epochs.get(file);
  if (e === undefined) {
    const n = Number.parseInt(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "", 10);
    e = Number.isSafeInteger(n) && n >= 0 ? n : 0;
    epochs.set(file, e);
  }
  return e;
}

/** Ends every session (logout): the next cookie is signed with the new epoch */
export function bumpSessionEpoch(): void {
  const file = fileOf(SESSION_EPOCH_FILE);
  const next = sessionEpoch() + 1;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(next), { mode: 0o600 });
  epochs.set(file, next);
}
