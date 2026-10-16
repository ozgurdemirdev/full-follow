import { beforeEach, describe, expect, it } from "vitest";
import { createCore, createRegistry, MCP_MODE_TOOLS, openDb, type Clock, type DraftRunsApi } from "@fullfollow/core";
import chat from "../src";
import { buildArgv } from "../src/server/claude-cli";

const clock: Clock = { today: () => "2026-10-16", now: () => "2026-10-16T10:00:00Z" };

describe("draft run queue rows", () => {
  let runs: DraftRunsApi;
  let sql: (q: string, ...a: unknown[]) => void;
  let session: number;
  beforeEach(() => {
    const h = openDb(":memory:");
    const core = createCore(h, "owner", clock, createRegistry([chat]));
    runs = core.mod("chat")!.draftRuns;
    sql = (q, ...a) => void h.sqlite.prepare(q).run(...a);
    session = core.mod("chat")!.createSession({}, { title: "Taslak: Ali" }).id;
    sql("INSERT INTO people (name, created_at, updated_at, created_by) VALUES ('Ali', 'x', 'x', 'owner'), ('Veli', 'x', 'x', 'owner')");
  });
  const draft = (personId: number, by = "claude") =>
    sql("INSERT INTO drafts (person_id, channel, body, status, created_at, updated_at, created_by) VALUES (?, 'email', 'b', 'bekliyor', 'x', 'x', ?)", personId, by);

  it("finds the active twin of a request by title and record only, and lets a finished one be asked again", () => {
    const a = runs.enqueue({ title: "Ali için taslak", person_id: 1 }, null);
    expect(runs.activeTwin({ title: "Ali için taslak", person_id: 1 })?.id).toBe(a.id);
    expect(runs.activeTwin({ title: "Ali için taslak", person_id: 2 })).toBeNull();
    expect(runs.activeTwin({ title: "Ali için taslak" })).toBeNull();
    runs.markRunning(a.id, session);
    expect(runs.activeTwin({ title: "Ali için taslak", person_id: 1 })?.state).toBe("running");
    runs.markFailed(a.id, "x");
    expect(runs.activeTwin({ title: "Ali için taslak", person_id: 1 })).toBeNull();
  });

  it("refuses a request about two records", () => {
    expect(() => runs.enqueue({ title: "t", person_id: 1, company_id: 2 }, null)).toThrow(/en fazla bir kayıt/);
  });

  it("takes the oldest queued request first", () => {
    const a = runs.enqueue({ title: "a" }, null);
    runs.enqueue({ title: "b" }, null);
    expect(runs.next()?.id).toBe(a.id);
    expect(runs.queuedCount()).toBe(2);
  });

  it("links the draft Claude saved after the start, the one on the request's person first, never an older one or the owner's", () => {
    draft(1);
    const r = runs.enqueue({ title: "Ali için taslak", person_id: 1 }, null);
    runs.markRunning(r.id, session);
    expect(runs.findDraft(r.id)).toBeNull();
    draft(1, "owner");
    draft(2);
    draft(1);
    expect(runs.findDraft(r.id)).toBe(4);
  });

  it("lists active runs and the done ones whose draft still waits", () => {
    const a = runs.enqueue({ title: "a", person_id: 1 }, null);
    runs.markRunning(a.id, session);
    draft(1);
    runs.markDone(a.id, runs.findDraft(a.id)!);
    const b = runs.enqueue({ title: "b" }, null);
    expect(runs.live().map((r) => r.id)).toEqual([b.id, a.id]);
    sql("UPDATE drafts SET status = 'onaylandi'");
    expect(runs.live().map((r) => r.id)).toEqual([b.id]);
  });
});

describe("argv of a draft run", () => {
  const session = { model: "claude-sonnet-5-5", effort: "medium", cli_session_id: "s", cli_started: false };
  const after = (argv: string[], flag: string) => {
    const i = argv.indexOf(flag);
    const list: string[] = [];
    for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j++) list.push(argv[j]);
    return list;
  };

  it("allows only the read tools and draft by name, no web tool, and starts the MCP host in draft mode", () => {
    const argv = buildArgv({ ...session, kind: "draft" });
    expect(after(argv, "--allowedTools")).toEqual(MCP_MODE_TOOLS.draft.map((t) => `mcp__full-follow__${t}`));
    expect(after(argv, "--tools")).toEqual(["ToolSearch"]);
    expect(after(argv, "--mcp-config")[0]).toMatch(/mcp-draft\.json$/);
    expect(argv.join(" ")).not.toMatch(/WebSearch|WebFetch|mcp__full-follow(\s|$)/);
  });

  it("keeps every Full Follow tool and the web tools for a panel chat", () => {
    const argv = buildArgv({ ...session, kind: "chat" });
    expect(after(argv, "--allowedTools")).toEqual(["mcp__full-follow", "WebSearch", "WebFetch"]);
    expect(after(argv, "--mcp-config")[0]).toMatch(/mcp\.json$/);
  });
});
