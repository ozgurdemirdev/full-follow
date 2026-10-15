import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hostAllowed } from "../src/guard";
import { precompressed } from "../src/static";
import { JSON_HEADERS, startServer, type TestServer } from "./helpers";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(() => server.close());

const post = (p: string, body: unknown = {}, headers: Record<string, string> = JSON_HEADERS) => server.request(p, { method: "POST", headers, body: JSON.stringify(body) });

describe("date and number inputs", () => {
  it("plan answers a short date, and garbage or a five digit year is a 400 at once instead of a loop", async () => {
    const started = Date.now();
    for (const date of ["garbage", "99999-01-01"]) {
      const r = await server.request(`/api/plan?date=${date}`);
      expect(r.status, date).toBe(400);
      expect(r.json.code).toBe("validation");
    }
    expect(Date.now() - started).toBeLessThan(1000);
    expect((await server.request(`/api/plan?date=${encodeURIComponent("bugün")}`)).status).toBe(200);
    expect((await server.request("/api/plan?date=%2B3g")).status).toBe(200);
    expect((await server.request("/api/calendar?from=garbage&to=2026-10-20")).status).toBe(400);
  });

  it("limit, offset, count and month that are not what they must be are 400s, not 500s, empty lists or every row", async () => {
    const bad = [
      "/api/people?limit=abc", "/api/people?limit=-1", "/api/people?limit=0", "/api/people?offset=-1", "/api/people?offset=x",
      "/api/today?limit=abc", "/api/timeline/person/1?limit=abc", "/api/network?limit=abc",
      "/api/report/months?count=20000", "/api/report/months?count=40000", "/api/report/months?count=0", "/api/report/months?count=abc",
      "/api/report?month=garbage", "/api/report?month=2026-13",
    ];
    for (const url of bad) {
      const r = await server.request(url);
      expect(r.status, url).toBe(400);
      expect(typeof r.json?.error, url).toBe("string");
    }
    for (const url of ["/api/people?limit=5&offset=0", "/api/people?limit=100000", "/api/today?limit=5", "/api/report/months?count=60", "/api/report?month=2026-10"]) {
      expect((await server.request(url)).status, url).toBe(200);
    }
  });

  it("an id that is not a small whole number is a 400 that names it as typed, never #NaN or #100000000000000000000", async () => {
    for (const id of ["100000000000000000000", "1.5", "0x10", "abc"]) {
      const r = await server.request(`/api/people/${id}`);
      expect(r.status, id).toBe(400);
      expect(r.json.error, id).toContain(id);
    }
    const r = await post("/api/opportunity-people", { opportunity_id: "abc", person_id: 1 });
    expect(r.status).toBe(400);
    expect(r.json.error).not.toContain("NaN");
  });

  it("PUT /api/settings without a body is a 400", async () => {
    const r = await server.request("/api/settings", { method: "PUT", headers: JSON_HEADERS });
    expect(r.status).toBe(400);
  });
});

describe("request guard", () => {
  it("a data changing request must declare a JSON or multipart body", async () => {
    expect((await post("/api/login")).status).toBeLessThan(300);
    expect((await server.request("/api/login", { method: "POST" })).status).toBe(415);
    expect((await server.request("/api/login", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })).status).toBe(415);
    expect((await server.request("/api/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=1" })).status).toBe(415);
    expect((await server.request("/api/tags/1", { method: "DELETE" })).status).toBe(415);
    expect((await server.request("/api/tags/1", { method: "DELETE", headers: JSON_HEADERS })).status).not.toBe(415);
    const r = await server.request("/api/files", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "--x--\r\n" });
    expect(r.status).not.toBe(415);
  });

  it("a Host that is not this computer is refused, whatever the method", async () => {
    const get = (host: string) => server.request("/api/health", { headers: { host } });
    expect((await get("localhost:3000")).status).toBe(200);
    expect((await get("127.0.0.1")).status).toBe(200);
    expect((await get("[::1]:3000")).status).toBe(200);
    expect((await get(`${Object.values(os.networkInterfaces()).flat().find((n) => n?.family === "IPv4")?.address ?? "127.0.0.1"}:3000`)).status).toBe(200);
    for (const host of ["evil.example", "evil.example:3000", "localhost.evil.example"]) expect((await get(host)).status, host).toBe(421);
    expect((await server.request("/api/login", { method: "POST", headers: { ...JSON_HEADERS, host: "evil.example" }, body: "{}" })).status).toBe(421);
    expect([hostAllowed(undefined), hostAllowed(""), hostAllowed("[::2]:80")]).toEqual([false, false, false]);
  });

  it("FF_ALLOWED_HOSTS adds names", async () => {
    process.env.FF_ALLOWED_HOSTS = "phone.local, other.local";
    try {
      expect((await server.request("/api/health", { headers: { host: "phone.local:3000" } })).status).toBe(200);
      expect((await server.request("/api/health", { headers: { host: "third.local" } })).status).toBe(421);
    } finally {
      delete process.env.FF_ALLOWED_HOSTS;
    }
  });
});

describe("errors before a route runs", () => {
  it("a body over the size limit is a 413 { error, code: http }, not a 500", async () => {
    const r = await post("/api/notes", { body: "x".repeat(300_000) });
    expect(r.status).toBe(413);
    expect(r.json).toMatchObject({ code: "http" });
    expect(typeof r.json.error).toBe("string");
  });

  it("a broken JSON body is a 400 { error, code: http }", async () => {
    const r = await server.request("/api/notes", { method: "POST", headers: JSON_HEADERS, body: "{nope" });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("http");
  });
});

describe("static files", () => {
  it("a malformed escape in the URL falls through to the next handler instead of throwing", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ff-static-"));
    const next = vi.fn();
    expect(() => precompressed(root)({ method: "GET", path: "/%zz", headers: {} } as never, {} as never, next)).not.toThrow();
    expect(next).toHaveBeenCalledOnce();
  });
});
