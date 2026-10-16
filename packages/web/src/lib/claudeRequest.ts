const RECORD_FIELDS = ["person_id", "company_id", "opportunity_id", "project_id", "idea_id"] as const;
export type ClaudeTarget = Partial<Record<(typeof RECORD_FIELDS)[number], number | null>>;

/** A request for Claude: a task of his on a record (or on nothing), and the toast that says where the result will appear */
export interface ClaudeRequest {
  title: string;
  target?: ClaudeTarget;
  ok: string;
}

/** Two requests are the same kind of request for the same record when the title and the record match */
export const requestKey = (title: string, target: ClaudeTarget = {}) => JSON.stringify([title, ...RECORD_FIELDS.map((f) => target[f] ?? null)]);

/** Keys of the requests that are still open: tasks of Claude's that are not done */
export const openRequestKeys = (tasks: readonly ({ title: string; assignee: string; done_at: string | null } & ClaudeTarget)[]) =>
  new Set(tasks.filter((t) => t.assignee === "claude" && !t.done_at).map((t) => requestKey(t.title, t)));
