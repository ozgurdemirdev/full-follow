import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AUTH_FILE, SCRYPT_COST, SCRYPT_KEY_BYTES, SCRYPT_MAXMEM, SCRYPT_SALT_BYTES } from "./constants";
import { m } from "./messages";
import { dataFile } from "./session-store";

/** What the password file holds: the scrypt parameters, the random salt and the derived key (hex). Never the password. */
export interface StoredPassword {
  kdf: "scrypt";
  N: number;
  r: number;
  p: number;
  salt: string;
  hash: string;
}

const HEX = /^(?:[0-9a-f]{2})+$/;
const cache = new Map<string, StoredPassword | null>();

/** The password file of the database in use */
export const authFile = () => dataFile(AUTH_FILE);

/** The same password typed on a phone and on a computer may differ in Unicode form (a composed or decomposed "ş") */
const derive = (password: string, salt: Buffer, cost: { N: number; r: number; p: number }, bytes: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFC"), salt, bytes, { N: cost.N, r: cost.r, p: cost.p, maxmem: SCRYPT_MAXMEM }, (e, key) => (e ? reject(e) : resolve(key))),
  );

function parse(text: string): StoredPassword | null {
  try {
    const v = JSON.parse(text) as Partial<StoredPassword>;
    const ints = [v.N, v.r, v.p].every((n) => Number.isSafeInteger(n) && (n as number) > 0);
    return v.kdf === "scrypt" && ints && typeof v.salt === "string" && HEX.test(v.salt) && typeof v.hash === "string" && HEX.test(v.hash)
      ? { kdf: "scrypt", N: v.N!, r: v.r!, p: v.p!, salt: v.salt, hash: v.hash }
      : null;
  } catch {
    return null;
  }
}

/**
 * The password set in the panel, or null when there is none. Read once per database and kept: the guard asks on every request.
 * A file that exists but cannot be read as a hash is an error, never "no password": that would turn the install back to its first run.
 */
export function storedPassword(): StoredPassword | null {
  const file = authFile();
  const known = cache.get(file);
  if (known !== undefined) return known;
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    cache.set(file, null);
    return null;
  }
  const stored = parse(text);
  if (!stored) throw new Error(m.auth.storeBroken(file));
  cache.set(file, stored);
  return stored;
}

/** A new salted hash of a password, with the current cost */
export async function hashPassword(password: string): Promise<StoredPassword> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const key = await derive(password, salt, SCRYPT_COST, SCRYPT_KEY_BYTES);
  return { kdf: "scrypt", ...SCRYPT_COST, salt: salt.toString("hex"), hash: key.toString("hex") };
}

/** Whether a password matches a stored hash (constant time compare of the derived keys) */
export async function verifyPassword(password: string, stored: StoredPassword): Promise<boolean> {
  const expected = Buffer.from(stored.hash, "hex");
  const key = await derive(password, Buffer.from(stored.salt, "hex"), stored, expected.length);
  return timingSafeEqual(key, expected);
}

/**
 * Stores a password (mode 0600 where the OS honours it). `first`: only when no file exists yet, so of two setups racing the second
 * gets false. Otherwise the file is replaced in one rename, so a crash mid write never leaves half a hash.
 */
export async function savePassword(password: string, { first }: { first: boolean }): Promise<boolean> {
  const stored = await hashPassword(password);
  const file = authFile();
  const text = JSON.stringify(stored);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (first) {
    try {
      fs.writeFileSync(file, text, { mode: 0o600, flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw e;
    }
  } else {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text, { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  cache.set(file, stored);
  return true;
}

/** Removes the stored password (the forgotten password script); the database and everything else stay. Whether there was one. */
export function clearStoredPassword(): boolean {
  const file = authFile();
  const had = fs.existsSync(file);
  fs.rmSync(file, { force: true });
  cache.delete(file);
  return had;
}
