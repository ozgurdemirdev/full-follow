import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OWNER_PASSWORD_MIN, SETUP_REQUIRED_CODE } from "@fullfollow/core";
import { AUTH_FILE } from "../src/constants";
import { JSON_HEADERS, startServer, type TestServer } from "./helpers";

const PASSWORD = "ilk-açılış-şifresi";
const NEXT = "yeni-şifre-0123";

let server: TestServer;
beforeAll(async () => {
  delete process.env.FF_PASSWORD;
  server = await startServer({ login: false });
});
afterAll(() => server.close());

const post = (url: string, body: unknown, cookie?: string) =>
  server.request(url, { method: "POST", headers: { ...JSON_HEADERS, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers["set-cookie"]).split(";")[0];
const tags = (cookie?: string) => server.request("/api/tags", { headers: cookie ? { cookie } : {} });

// one file, in order: the first run, the setup, then the change of the password it set
describe("first run", () => {
  it("answers only the setup and the health check; everything else is a 401 the web turns into the setup screen", async () => {
    expect((await server.request("/api/health")).status).toBe(200);
    for (const url of ["/api/me", "/api/tags", "/api/settings", "/api/today"]) {
      const r = await server.request(url);
      expect(r.status, url).toBe(401);
      expect(r.json.code, url).toBe(SETUP_REQUIRED_CODE);
    }
    expect((await post("/api/login", { password: "anything" })).json.code).toBe(SETUP_REQUIRED_CODE);
  });

  it("refuses a short password or a missing name and stores nothing", async () => {
    const short = await post("/api/setup", { name: "Özgür", password: "x".repeat(OWNER_PASSWORD_MIN - 1) });
    expect(short.status).toBe(400);
    expect(short.json.error).toContain(String(OWNER_PASSWORD_MIN));
    expect((await post("/api/setup", { name: "  ", password: PASSWORD })).status).toBe(400);
    expect(fs.existsSync(path.join(server.dir, AUTH_FILE))).toBe(false);
  });

  it("sets the name and the password once, logs this browser in, then answers 409", async () => {
    const r = await post("/api/setup", { name: " Özgür ", password: PASSWORD });
    expect(r.status).toBe(201);
    expect(r.json).toEqual({ ok: true, owner_name: "Özgür" });
    const cookie = cookieOf(r);
    expect((await tags(cookie)).status).toBe(200);
    expect((await server.request("/api/me", { headers: { cookie } })).json).toEqual({ auth: true, loggedIn: true, password: "app" });
    expect((await tags()).status).toBe(401);
    expect((await tags()).json.code).not.toBe(SETUP_REQUIRED_CODE);

    const again = await post("/api/setup", { name: "Biri", password: "başka-bir-şifre" });
    expect(again.status).toBe(409);
    expect((await server.request("/api/settings", { headers: { cookie } })).json.owner_name).toBe("Özgür");
  });

  it("keeps only a salted scrypt hash beside the database, never in the settings or a reply", async () => {
    const file = path.join(server.dir, AUTH_FILE);
    const text = fs.readFileSync(file, "utf8");
    expect(text).not.toContain(PASSWORD);
    expect(JSON.parse(text)).toMatchObject({ kdf: "scrypt", salt: expect.stringMatching(/^[0-9a-f]{32}$/), hash: expect.stringMatching(/^[0-9a-f]{128}$/) });
    if (process.platform !== "win32") expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const login = await post("/api/login", { password: PASSWORD });
    expect(login.status).toBe(201);
    const settings = await server.request("/api/settings", { headers: { cookie: cookieOf(login) } });
    expect(settings.body).not.toContain(JSON.parse(text).hash);
    expect((await post("/api/login", { password: `${PASSWORD}!` })).status).toBe(401);
  });

  it("changing the password needs the current one, ends every session and gives this browser a new one", async () => {
    const phone = cookieOf(await post("/api/login", { password: PASSWORD }));
    const computer = cookieOf(await post("/api/login", { password: PASSWORD }));
    expect((await post("/api/password", { current: "yanlış-şifre-123", password: NEXT }, computer)).status).toBe(403);
    expect((await post("/api/password", { current: PASSWORD, password: "kısa" }, computer)).status).toBe(400);
    expect((await post("/api/password", { current: PASSWORD, password: NEXT })).status).toBe(401);

    const changed = await post("/api/password", { current: PASSWORD, password: NEXT }, computer);
    expect(changed.status).toBe(201);
    expect((await tags(phone)).status).toBe(401);
    expect((await tags(computer)).status).toBe(401);
    expect((await tags(cookieOf(changed))).status).toBe(200);
    expect((await post("/api/login", { password: PASSWORD })).status).toBe(401);
    expect((await post("/api/login", { password: NEXT })).status).toBe(201);
  });

  it("FF_PASSWORD wins over the stored password: login takes it, setup and change refuse", async () => {
    process.env.FF_PASSWORD = "env-password-456";
    try {
      expect((await post("/api/login", { password: NEXT })).status).toBe(401);
      const login = await post("/api/login", { password: "env-password-456" });
      expect(login.status).toBe(201);
      const cookie = cookieOf(login);
      expect((await server.request("/api/me", { headers: { cookie } })).json.password).toBe("env");
      expect((await post("/api/password", { current: "env-password-456", password: "something-else-1" }, cookie)).status).toBe(409);
      expect((await post("/api/setup", { name: "Biri", password: "something-else-1" })).status).toBe(409);
    } finally {
      delete process.env.FF_PASSWORD;
    }
  });
});
