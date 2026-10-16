import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { FFError, parse, row, rows, schema, stamp, type Ctx, type DraftRun, type DraftRunsApi } from "@fullfollow/core";
import { DRAFT_RUN_LIMITS } from "../constants";
import { m } from "../messages";
import { draftRunCreate, type DraftRunInput } from "./schemas";

const { draft_runs } = schema;
/** The record fields of a request, in the order the key and the draft match read them */
export const RUN_RECORD_FIELDS = ["person_id", "company_id", "opportunity_id", "project_id", "idea_id"] as const;
const ACTIVE = ["queued", "running"] as const;

type Draft = { id: number; person_id: number | null; company_id: number | null; opportunity_id: number | null; project_id: number | null };

/** The draft queue's rows: a request is keyed by its title and record, so a second press never queues a second run */
export function draftRunsService(ctx: Ctx): DraftRunsApi {
  const get = (id: number): DraftRun => {
    const r = ctx.db.select().from(draft_runs).where(eq(draft_runs.id, id)).get();
    if (!r) throw new FFError("not_found", m.draftErrors.runNotFound(id));
    return r as DraftRun;
  };

  const sameKey = (d: DraftRunInput): SQL[] => [
    eq(draft_runs.title, d.title),
    ...RUN_RECORD_FIELDS.map((f) => (d[f] === null ? isNull(draft_runs[f]) : eq(draft_runs[f], d[f]!))),
  ];

  function activeTwin(input: unknown): DraftRun | null {
    const d = parse(draftRunCreate, input);
    const r = ctx.db.select().from(draft_runs).where(and(...sameKey(d), inArray(draft_runs.state, [...ACTIVE]))).orderBy(desc(draft_runs.id)).get();
    return (r as DraftRun | undefined) ?? null;
  }

  function enqueue(input: unknown, taskId: number | null): DraftRun {
    const d = parse(draftRunCreate, input);
    return ctx.db.insert(draft_runs).values({ ...d, task_id: taskId, state: "queued", ...stamp(ctx) }).returning().get() as DraftRun;
  }

  /** Reads the drafts table of the drafts module: a finished run keeps its "Taslak hazır" button only while its draft still waits */
  function live(): DraftRun[] {
    const since = new Date(Date.parse(ctx.clock.now()) - DRAFT_RUN_LIMITS.readyKeepMs).toISOString();
    return rows<DraftRun>(ctx, `
      SELECT r.* FROM draft_runs r LEFT JOIN drafts d ON d.id = r.draft_id
      WHERE r.state IN ('queued', 'running') OR (r.state = 'done' AND r.finished_at >= ? AND d.status = 'bekliyor')
      ORDER BY r.id DESC LIMIT ?`, since, DRAFT_RUN_LIMITS.listMax);
  }

  const queuedCount = () => ctx.db.select({ n: sql<number>`count(*)` }).from(draft_runs).where(eq(draft_runs.state, "queued")).get()!.n;
  const next = () => (ctx.db.select().from(draft_runs).where(eq(draft_runs.state, "queued")).orderBy(asc(draft_runs.id)).get() as DraftRun | undefined) ?? null;
  const running = () => ctx.db.select().from(draft_runs).where(eq(draft_runs.state, "running")).all() as DraftRun[];

  function move(id: number, from: DraftRun["state"], set: Partial<typeof draft_runs.$inferInsert>): DraftRun {
    const cur = get(id);
    if (cur.state !== from) throw new FFError("rule", m.draftErrors.badState(id, cur.state));
    ctx.db.update(draft_runs).set({ ...set, updated_at: ctx.clock.now() }).where(eq(draft_runs.id, id)).run();
    return get(id);
  }

  /** Reads the drafts table: the highest id now, so the draft this run saves is the first one after it */
  function markRunning(id: number, sessionId: number): DraftRun {
    const before = row<{ n: number | null }>(ctx, "SELECT max(id) AS n FROM drafts")?.n ?? 0;
    return move(id, "queued", { state: "running", session_id: sessionId, started_at: ctx.clock.now(), drafts_before: before });
  }

  /** Reads the drafts table: Claude's drafts saved since the run started, the one on the request's record first */
  function findDraft(id: number): number | null {
    const run = get(id);
    const saved = rows<Draft>(ctx, "SELECT id, person_id, company_id, opportunity_id, project_id FROM drafts WHERE id > ? AND created_by = 'claude' ORDER BY id", run.drafts_before ?? 0);
    const mine = saved.find((d) =>
      (run.person_id !== null && d.person_id === run.person_id) || (run.company_id !== null && d.company_id === run.company_id)
      || (run.opportunity_id !== null && d.opportunity_id === run.opportunity_id) || (run.project_id !== null && d.project_id === run.project_id));
    return (mine ?? saved[0])?.id ?? null;
  }

  const finish = (id: number, set: Partial<typeof draft_runs.$inferInsert>) => move(id, "running", { ...set, finished_at: ctx.clock.now() });
  const markDone = (id: number, draftId: number) => finish(id, { state: "done", draft_id: draftId, error: null });

  /** A queued request can fail too (the CLI is missing when its turn comes) */
  function markFailed(id: number, reason: string): DraftRun {
    const cur = get(id);
    return cur.state === "queued" ? move(id, "queued", { state: "failed", error: reason, finished_at: ctx.clock.now() }) : finish(id, { state: "failed", error: reason });
  }

  return { activeTwin, enqueue, get, live, queuedCount, next, running, markRunning, findDraft, markDone, markFailed };
}
