import { describe, expect, it } from "vitest";
import { openRequestKeys, requestKey } from "../src/lib/claudeRequest";

const task = (over: Partial<{ title: string; assignee: string; done_at: string | null; person_id: number | null; company_id: number | null }>) =>
  ({ title: "Doğu için taslak", assignee: "claude", done_at: null, person_id: 7, company_id: null, ...over });

describe("requests for Claude", () => {
  it("an open task of Claude's on the same record with the same title counts as the request", () => {
    const open = openRequestKeys([task({})]);
    expect(open.has(requestKey("Doğu için taslak", { person_id: 7 }))).toBe(true);
  });

  it("another record, another title, a finished task or a task of Özgür's does not", () => {
    const open = openRequestKeys([task({ done_at: "2026-10-16T09:00:00Z" }), task({ assignee: "ozgur" }), task({ person_id: 8 }), task({ title: "başka" })]);
    expect(open.has(requestKey("Doğu için taslak", { person_id: 7 }))).toBe(false);
    expect(open.has(requestKey("Doğu için taslak", { company_id: 7 }))).toBe(false);
  });
});
