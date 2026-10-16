import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Type } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { SESSION_SECRET_FILE } from "../src/constants";
import { openApiDocument } from "../src/openapi/openapi.controller";
import { JSON_HEADERS, startServer, type TestServer } from "./helpers";

const PASSWORD = "test-password-123";
/** The routes that answer without a session: who is logged in, the login and logout themselves, and the health check */
const PUBLIC = new Set(["/api/me", "/api/login", "/api/logout", "/api/health"]);

let server: TestServer;
beforeAll(async () => {
  process.env.FF_PASSWORD = PASSWORD;
  server = await startServer();
});
afterAll(async () => {
  delete process.env.FF_PASSWORD;
  await server.close();
});

const controllers = Reflect.getMetadata("controllers", AppModule) as Type<unknown>[];
const operations = Object.entries((openApiDocument(controllers) as { paths: Record<string, Record<string, unknown>> }).paths)
  .flatMap(([route, methods]) => Object.keys(methods).map((method) => ({ method: method.toUpperCase(), route, url: route.replace(/\{\w+\}/g, "1") })))
  .filter((o) => !PUBLIC.has(o.route));

describe("password protection", () => {
  it("the document lists routes to check, the core ones whatever modules are installed", () => {
    const listed = operations.map((o) => `${o.method} ${o.route}`);
    expect(listed).toEqual(expect.arrayContaining(["GET /api/tags", "POST /api/notes", "GET /api/today", "PUT /api/settings"]));
    expect(operations.length).toBeGreaterThan(30);
  });

  it("every documented route answers 401 without the session cookie, and not 401 with it", async () => {
    const wrong = await server.request("/api/login", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ password: "nope" }) });
    expect(wrong.status).toBe(401);
    const login = await server.request("/api/login", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ password: PASSWORD }) });
    expect(login.status).toBeLessThan(300);
    const cookie = String(login.headers["set-cookie"]).split(";")[0];

    const send = (o: (typeof operations)[number], headers: Record<string, string>) =>
      server.request(o.url, { method: o.method, headers: { ...JSON_HEADERS, ...headers }, body: o.method === "GET" || o.method === "DELETE" ? undefined : "{}" });
    const open: string[] = [];
    const locked: string[] = [];
    for (const o of operations) {
      if ((await send(o, {})).status !== 401) open.push(`${o.method} ${o.route}`);
      if ((await send(o, { cookie })).status === 401) locked.push(`${o.method} ${o.route}`);
    }
    expect(open).toEqual([]);
    expect(locked).toEqual([]);
  });

  it("the public routes answer without a cookie", async () => {
    expect((await server.request("/api/health")).status).toBe(200);
    expect((await server.request("/api/me")).json).toMatchObject({ auth: true, loggedIn: false });
  });
});

describe("session cookie", () => {
  const login = async () => {
    const r = await server.request("/api/login", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ password: process.env.FF_PASSWORD }) });
    expect(r.status).toBeLessThan(300);
    return String(r.headers["set-cookie"]).split(";")[0];
  };
  const tags = (cookie: string) => server.request("/api/tags", { headers: { cookie } });

  it("is signed with a random key kept beside the database, never with one derived from the password", async () => {
    const cookie = await login();
    const [exp, epoch, sig] = decodeURIComponent(cookie.split("=")[1]).split(".");
    const derived = createHash("sha256").update(`ff:${PASSWORD}`).digest("hex");
    const pwDigest = createHash("sha256").update(PASSWORD).digest("hex");
    for (const text of [exp, `${exp}.${epoch}`, `${exp}.${epoch}.${pwDigest}`]) expect(createHmac("sha256", derived).update(text).digest("hex")).not.toBe(sig);
    const key = fs.readFileSync(path.join(server.dir, SESSION_SECRET_FILE), "utf8");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(createHmac("sha256", key).update(`${exp}.${epoch}.${pwDigest}`).digest("hex")).toBe(sig);
  });

  it("stops working after logout, on every device, and a logout without a session ends nothing", async () => {
    const phone = await login();
    const computer = await login();
    expect((await tags(phone)).status).toBe(200);
    expect((await server.request("/api/logout", { method: "POST", headers: JSON_HEADERS, body: "{}" })).status).toBe(201);
    expect((await tags(phone)).status).toBe(200);
    expect((await server.request("/api/logout", { method: "POST", headers: { ...JSON_HEADERS, cookie: computer }, body: "{}" })).status).toBe(201);
    expect((await tags(computer)).status).toBe(401);
    expect((await tags(phone)).status).toBe(401);
    expect((await tags(await login())).status).toBe(200);
  });

  it("stops working when the password changes", async () => {
    const cookie = await login();
    process.env.FF_PASSWORD = "another-password-456";
    try {
      expect((await tags(cookie)).status).toBe(401);
    } finally {
      process.env.FF_PASSWORD = PASSWORD;
    }
    expect((await tags(cookie)).status).toBe(200);
  });
});
