import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SCRYPT_COST, SCRYPT_KEY_BYTES, SCRYPT_SALT_BYTES } from "../src/constants";
import { listenHost, mayListen } from "../src/listen";
import { authFile, clearStoredPassword, hashPassword, savePassword, storedPassword, verifyPassword } from "../src/password-store";
import { resetPassword } from "../src/reset-password";

// every test gets its own data folder (the password file lives beside FF_DB)
beforeEach(() => {
  process.env.FF_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ff-password-test-")), "test.db");
});
afterEach(() => {
  delete process.env.FF_PASSWORD;
});

describe("stored password", () => {
  it("is a salted scrypt hash with its cost, and only the same password verifies", async () => {
    const a = await hashPassword("doğru-şifre-123");
    const b = await hashPassword("doğru-şifre-123");
    expect(a).toMatchObject({ kdf: "scrypt", ...SCRYPT_COST });
    expect(a.salt).toHaveLength(SCRYPT_SALT_BYTES * 2);
    expect(a.hash).toHaveLength(SCRYPT_KEY_BYTES * 2);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPassword("doğru-şifre-123", a)).toBe(true);
    expect(await verifyPassword("doğru-şifre-124", a)).toBe(false);
    // the same letters typed in another Unicode form ("ş" as s + cedilla) are the same password
    expect(await verifyPassword("doğru-şifre-123".normalize("NFD"), a)).toBe(true);
  });

  it("is created once by the first run (a second first write loses) and replaced by a change", async () => {
    expect(storedPassword()).toBeNull();
    expect(await savePassword("birinci-şifre", { first: true })).toBe(true);
    expect(await savePassword("ikinci-şifre1", { first: true })).toBe(false);
    expect(await verifyPassword("birinci-şifre", storedPassword()!)).toBe(true);
    await savePassword("üçüncü-şifre", { first: false });
    expect(await verifyPassword("üçüncü-şifre", storedPassword()!)).toBe(true);
    expect(fs.readdirSync(path.dirname(authFile())).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("a damaged file is an error, never a silent first run", () => {
    fs.mkdirSync(path.dirname(authFile()), { recursive: true });
    fs.writeFileSync(authFile(), "{ not json");
    expect(() => storedPassword()).toThrow(/reset-password/);
    clearStoredPassword();
    expect(storedPassword()).toBeNull();
  });
});

describe("npm run reset-password", () => {
  const run = async (answer: string | null) => {
    const input = new PassThrough();
    const output = new PassThrough();
    let said = "";
    output.on("data", (c) => (said += c));
    const done = resetPassword({ input, output });
    if (answer === null) input.end();
    else input.write(`${answer}\n`);
    return { removed: await done, said };
  };

  it("removes the stored password after a yes and leaves the database folder alone", async () => {
    await savePassword("unutulan-şifre", { first: true });
    const db = process.env.FF_DB!;
    fs.writeFileSync(db, "data");
    const r = await run("E");
    expect(r.removed).toBe(true);
    expect(fs.existsSync(authFile())).toBe(false);
    expect(storedPassword()).toBeNull();
    expect(fs.readFileSync(db, "utf8")).toBe("data");
  });

  it("keeps it on any other answer or when the input ends", async () => {
    await savePassword("kalan-şifre-1", { first: true });
    expect((await run("h")).removed).toBe(false);
    expect((await run(null)).removed).toBe(false);
    expect(fs.existsSync(authFile())).toBe(true);
  });

  it("says there is nothing to remove, and that FF_PASSWORD stays in .env", async () => {
    process.env.FF_PASSWORD = "env-password-1";
    const r = await run(null);
    expect(r.removed).toBe(false);
    expect(r.said).toContain("FF_PASSWORD");
  });
});

describe("listen address", () => {
  it("a password set in the panel alone stays on this computer; the phone setting or FF_HOST opens it", () => {
    expect(listenHost("app", false, "")).toBe("127.0.0.1");
    expect(listenHost("app", true, "")).toBe("0.0.0.0");
    expect(listenHost("app", false, "100.64.0.5")).toBe("100.64.0.5");
  });

  it("FF_PASSWORD without FF_HOST opens the network as before, whatever the phone setting says", () => {
    expect(listenHost("env", false, "")).toBe("0.0.0.0");
    expect(listenHost("env", false, "127.0.0.1")).toBe("127.0.0.1");
  });

  it("the first run is loopback only: the phone setting is ignored and an open FF_HOST is refused", () => {
    expect(listenHost(null, true, "")).toBe("127.0.0.1");
    expect(mayListen(null, "127.0.0.1")).toBe(true);
    expect(mayListen(null, listenHost(null, true, "0.0.0.0"))).toBe(false);
    expect(mayListen("app", "0.0.0.0")).toBe(true);
  });
});
