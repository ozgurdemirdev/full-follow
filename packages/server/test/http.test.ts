import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { APP_CSP, DOCS_CSP } from "../src/constants";
import { hostAllowed } from "../src/guard";
import { precompressed } from "../src/static";
import { available, installed, JSON_HEADERS, startServer, type TestServer } from "./helpers";

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(() => server.close());

const post = (p: string, body: unknown = {}, headers: Record<string, string> = JSON_HEADERS) => server.request(p, { method: "POST", headers, body: JSON.stringify(body) });

describe("date and number inputs", () => {
  it.skipIf(!installed("calendar"))("plan answers a short date, and garbage or a five digit year is a 400 at once instead of a loop", async () => {
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
    const bad = available([
      "/api/tags?limit=abc", "/api/tags?limit=-1", "/api/tags?limit=0", "/api/tags?offset=-1", "/api/tags?offset=x", "/api/today?limit=abc",
      ["people", "/api/people?limit=abc"], ["people", "/api/people?limit=-1"], ["people", "/api/people?limit=0"], ["people", "/api/people?offset=-1"], ["people", "/api/people?offset=x"],
      ["timeline", "/api/timeline/person/1?limit=abc"], ["network", "/api/network?limit=abc"],
      ["reports", "/api/report/months?count=20000"], ["reports", "/api/report/months?count=40000"], ["reports", "/api/report/months?count=0"], ["reports", "/api/report/months?count=abc"],
      ["reports", "/api/report?month=garbage"], ["reports", "/api/report?month=2026-13"],
    ]);
    for (const url of bad) {
      const r = await server.request(url);
      expect(r.status, url).toBe(400);
      expect(typeof r.json?.error, url).toBe("string");
    }
    const good = available([
      "/api/tags?limit=5&offset=0", "/api/tags?limit=100000", "/api/today?limit=5",
      ["people", "/api/people?limit=5&offset=0"], ["people", "/api/people?limit=100000"],
      ["reports", "/api/report/months?count=60"], ["reports", "/api/report?month=2026-10"],
    ]);
    for (const url of good) expect((await server.request(url)).status, url).toBe(200);
  });

  it("an id that is not a small whole number is a 400 that names it as typed, never #NaN or #100000000000000000000", async () => {
    for (const id of ["100000000000000000000", "1.5", "0x10", "abc"]) {
      const r = await server.request(`/api/sources/${id}`);
      expect(r.status, id).toBe(400);
      expect(r.json.error, id).toContain(id);
    }
  });

  it.skipIf(!installed("pipeline"))("a body id that is not a number is a 400 without NaN in it", async () => {
    const r = await post("/api/opportunity-people", { opportunity_id: "abc", person_id: 1 });
    expect(r.status).toBe(400);
    expect(r.json.error).not.toContain("NaN");
  });

  it("a date that does not exist is a 400 on a settings value, and on a task due date when the calendar is installed", async () => {
    const put = (body: unknown) => server.request("/api/settings", { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(body) });
    for (const email_warmup_until of ["2026-13-45", "2026-02-31"]) expect((await put({ email_warmup_until })).status, email_warmup_until).toBe(400);
    if (!installed("calendar")) return;
    for (const due_date of ["2026-13-45", "2026-02-31"]) {
      const r = await post("/api/tasks", { title: "x", due_date });
      expect(r.status, due_date).toBe(400);
      expect(r.json.code).toBe("validation");
    }
    expect((await post("/api/tasks", { title: "x", due_date: "2026-02-28" })).status).toBe(201);
  });

  it("PUT /api/settings without a body is a 400", async () => {
    const r = await server.request("/api/settings", { method: "PUT", headers: JSON_HEADERS });
    expect(r.status).toBe(400);
  });
});

describe("web address fields", () => {
  const BAD = ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///C:/Windows/win.ini"];
  const patch = (p: string, body: unknown) => server.request(p, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body) });

  it.skipIf(!installed("companies"))("a company website and a link accept only http and https, and a bare domain gets https", async () => {
    const company = await post("/api/companies", { name: "Örnek Yazılım", website: "ornekyazilim.com" });
    expect(company.status).toBe(201);
    expect(company.json.row.website).toBe("https://ornekyazilim.com");
    for (const url of BAD) {
      expect((await post("/api/companies", { name: `Kötü ${url.slice(0, 4)}`, website: url })).status, url).toBe(400);
      expect((await patch(`/api/companies/${company.json.row.id}`, { website: url })).status, url).toBe(400);
    }
    const link = { target_type: "company", target_id: company.json.row.id, label: "Site" };
    for (const url of BAD) expect((await post("/api/links", { ...link, url })).status, url).toBe(400);
  });

  it("opportunity and post links refuse other schemes before anything else is checked", async () => {
    for (const p of available([["pipeline", "/api/opportunities/999999"], ["posts", "/api/posts/999999"]])) {
      const field = p.includes("posts") ? "url" : "source_url";
      for (const url of BAD) expect((await patch(p, { [field]: url })).status, `${p} ${url}`).toBe(400);
      expect((await patch(p, { [field]: "https://ornek.com/ilan" })).status, p).toBe(404);
    }
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

  it("a data changing request from another origin or another port of this host is refused, multipart included", async () => {
    const multipart = { "content-type": "multipart/form-data; boundary=x" };
    const isMultipart = (url: string) => url === "/api/files" || url.endsWith("/attachments");
    const routes = available(["/api/files", ["chat", "/api/chat/sessions/1/attachments"], ["drafts", "/api/followups/run"], ["network", "/api/touches/adopt-suggested"]]);
    const self = `http://127.0.0.1:${server.port}`;
    const send = (url: string, extra: Record<string, string>) =>
      server.request(url, { method: "POST", headers: { ...(isMultipart(url) ? multipart : JSON_HEADERS), ...extra }, body: isMultipart(url) ? "--x--\r\n" : "{}" });
    for (const r of routes) {
      for (const extra of [{ origin: "http://127.0.0.1:5173" }, { origin: "https://evil.example" }, { origin: "null" }, { "sec-fetch-site": "same-site" }, { "sec-fetch-site": "cross-site" }, { origin: self, "sec-fetch-site": "cross-site" }]) {
        expect((await send(r, extra)).status, `${r} ${JSON.stringify(extra)}`).toBe(403);
      }
      for (const extra of [{ origin: self }, { origin: self, "sec-fetch-site": "same-origin" }, { "sec-fetch-site": "none" }, {}]) {
        expect((await send(r, extra)).status, `${r} ${JSON.stringify(extra)}`).not.toBe(403);
      }
    }
    expect((await server.request("/api/health", { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } })).status).toBe(200);
  });

  it("every answer carries the security headers, refusals included; the Swagger UI page gets its own policy", async () => {
    for (const r of [await server.request("/api/health"), await server.request("/api/health", { headers: { host: "evil.example" } }), await server.request("/api/files/999999")]) {
      expect(r.headers["content-security-policy"]).toBe(APP_CSP);
      expect(r.headers).toMatchObject({ "x-frame-options": "DENY", "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" });
    }
    expect(APP_CSP).toMatch(/default-src 'self'.*frame-ancestors 'none'/);
    expect(APP_CSP).not.toContain("unsafe");
    expect((await server.request("/api/docs")).headers["content-security-policy"]).toBe(DOCS_CSP);
    expect((await server.request("/api/docs/init.js")).headers["content-security-policy"]).toBe(DOCS_CSP);
    expect((await server.request("/api/docsx")).headers["content-security-policy"]).toBe(APP_CSP);
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
