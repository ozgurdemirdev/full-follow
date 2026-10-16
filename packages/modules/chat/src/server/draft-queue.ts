import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { APP_TOKEN, CLAUDE_APP_TOKEN, FFError, localDate, parse, readSetting, row, type ChatMessage, type Core, type DraftRun, type TaskRecord } from "@fullfollow/core";
import { DRAFT_RUN_LIMITS, DRAFT_RUNS_CHANNEL } from "../constants";
import { m } from "../messages";
import { RUN_RECORD_FIELDS } from "../service/draft-runs";
import { draftRunCreate, type DraftRunInput } from "../service/schemas";
import { ChatHub } from "./chat-hub";
import { mcpBuilt } from "./chat-files";
import { CHAT_ERROR_TEXT } from "./chat.config";
import { resolveCli } from "./claude-cli";
import { ClaudeRunner } from "./claude-runner";

const T = m.draftRun;

/** Record type and the table its name is read from, per request field (reads of the owning modules' tables, which always exist) */
const RECORD_NAME: Record<(typeof RUN_RECORD_FIELDS)[number], { type: string; sql: string }> = {
  person_id: { type: "person", sql: "SELECT name AS n FROM people WHERE id = ?" },
  company_id: { type: "company", sql: "SELECT name AS n FROM companies WHERE id = ?" },
  opportunity_id: { type: "opportunity", sql: "SELECT title AS n FROM opportunities WHERE id = ?" },
  project_id: { type: "project", sql: "SELECT name AS n FROM projects WHERE id = ?" },
  idea_id: { type: "idea", sql: "SELECT title AS n FROM ideas WHERE id = ?" },
};

export type DraftRequestResult = { mode: "run"; run: DraftRun } | { mode: "task"; task: TaskRecord; effects: string[] };

/**
 * The draft queue: a draft request starts a background Claude run on a chat session of kind "draft" (restricted tools), one at a time;
 * a second request for the same record returns the run already queued or running. When the run ends, its task is closed (a draft was
 * saved) or removed (it failed, so the button can be pressed again). With auto drafting off, or no Claude CLI, the request becomes
 * Claude's task as before.
 */
@Injectable()
export class DraftQueue implements OnModuleInit, OnModuleDestroy {
  private off?: () => void;

  constructor(
    @Inject(APP_TOKEN) private core: Core,
    @Inject(CLAUDE_APP_TOKEN) private claude: Core,
    @Inject(ClaudeRunner) private runner: ClaudeRunner,
    @Inject(ChatHub) private hub: ChatHub,
  ) {}

  private get runs() {
    return this.core.mod("chat")!.draftRuns;
  }

  onModuleInit() {
    this.off = this.runner.onTurnEnd((sessionId, message) => this.onTurnEnd(sessionId, message));
    const dangling = this.runs.running();
    for (const run of dangling) this.fail(run, m.draftErrors.restart);
    if (dangling.length) console.log(m.log.draftRunsFailed(dangling.length));
    // requests that were waiting when the server stopped run now
    setImmediate(() => this.pump());
  }

  onModuleDestroy() {
    this.off?.();
  }

  /** Auto drafting is on, a draft can be saved and Claude can be started */
  private usable(): boolean {
    return this.core.settings.all().draft_auto && !!this.core.mod("drafts") && !!resolveCli() && mcpBuilt();
  }

  request(input: unknown): DraftRequestResult {
    const twin = this.runs.activeTwin(input);
    if (twin) return { mode: "run", run: twin };
    const d = parse(draftRunCreate, input);
    if (!this.usable()) return this.asTask(d);
    if (this.runs.queuedCount() >= DRAFT_RUN_LIMITS.maxQueued) throw new FFError("rule", m.draftErrors.queueFull(DRAFT_RUN_LIMITS.maxQueued));
    const run = this.runs.enqueue(d, this.openTask(d)?.id ?? null);
    this.publish(run);
    this.pump();
    return { mode: "run", run: this.runs.get(run.id) };
  }

  live(): DraftRun[] {
    return this.runs.live();
  }

  /** The fallback: Claude's task for today on the record, written by its next session */
  private asTask(d: DraftRunInput): DraftRequestResult {
    const calendar = this.core.mod("calendar");
    if (!calendar) throw new FFError("rule", m.draftErrors.noFallback);
    const { channel: _channel, ...target } = d;
    const r = calendar.tasks.create({ ...target, assignee: "claude", due_date: localDate() });
    return { mode: "task", task: r.row, effects: r.effects };
  }

  /** Claude's open task for the same request (asked earlier, before auto drafting), else a new one; null without the calendar module */
  private openTask(d: DraftRunInput): TaskRecord | null {
    const calendar = this.core.mod("calendar");
    if (!calendar) return null;
    // a read of the calendar module's tasks table: the same title on the same record, still open
    const same = RUN_RECORD_FIELDS.map((f) => `${f} IS ?`).join(" AND ");
    const open = row<TaskRecord>(this.core.ctx, `SELECT * FROM tasks WHERE assignee = 'claude' AND done_at IS NULL AND title = ? AND ${same} ORDER BY id LIMIT 1`,
      d.title, ...RUN_RECORD_FIELDS.map((f) => d[f]));
    if (open) return open;
    const { channel: _channel, ...target } = d;
    return calendar.tasks.create({ ...target, assignee: "claude", due_date: localDate() }).row;
  }

  private publish(run: DraftRun) {
    this.hub.emit(DRAFT_RUNS_CHANNEL, "run", run);
  }

  /** Starts queued runs while there is room; a run that finds the runner full stays queued until the next turn ends */
  private pump() {
    while (this.runs.running().length < DRAFT_RUN_LIMITS.concurrency) {
      const next = this.runs.next();
      if (!next || !this.runner.hasRoom()) return;
      this.start(next);
    }
  }

  private recordOf(run: DraftRun): { type: string; id: number; name: string | null } | null {
    const field = RUN_RECORD_FIELDS.find((f) => run[f] !== null);
    if (!field) return null;
    const id = run[field]!;
    return { type: RECORD_NAME[field].type, id, name: row<{ n: string }>(this.core.ctx, RECORD_NAME[field].sql, id)?.n ?? null };
  }

  /** The learned rules (setting `draft_rules`); a broken value reads as none */
  private learnedRules(): string[] {
    try {
      const list: unknown = JSON.parse(readSetting(this.core.ctx, "draft_rules") ?? "[]");
      return Array.isArray(list) ? list.filter((r): r is string => typeof r === "string") : [];
    } catch {
      return [];
    }
  }

  private start(run: DraftRun) {
    if (!resolveCli()) return this.fail(run, CHAT_ERROR_TEXT.cli_missing);
    const rec = this.recordOf(run);
    const name = (rec?.name ?? run.title).slice(0, DRAFT_RUN_LIMITS.titleNameChars);
    const s = this.core.settings.all();
    const session = this.core.mod("chat")!.createSession({ model: s.draft_model, effort: s.draft_effort }, { title: T.sessionTitle(name) });
    this.publish(this.runs.markRunning(run.id, session.id));
    const body = [T.request(run.title), rec && T.record(rec.type, rec.id, rec.name), run.channel && T.channelLine(run.channel)].filter(Boolean).join("\n");
    const rules = this.learnedRules();
    const hidden = [T.rules, run.channel ? T.channel(run.channel) : T.anyChannel, ...(rules.length ? [T.learned(rules.map((r) => `- ${r}`).join("\n"))] : [])];
    try {
      this.runner.send(session.id, { body, client_id: `draft-run-${run.id}` }, hidden);
    } catch (e) {
      this.fail(this.runs.get(run.id), e instanceof Error ? e.message : CHAT_ERROR_TEXT.unknown);
    }
  }

  private onTurnEnd(sessionId: number, message: ChatMessage) {
    const run = this.runs.running().find((r) => r.session_id === sessionId);
    if (run) {
      if (message.state !== "done") this.fail(run, message.state === "stopped" ? m.draftErrors.stopped : message.error ?? CHAT_ERROR_TEXT.unknown);
      else {
        const draftId = this.runs.findDraft(run.id);
        if (draftId === null) this.fail(run, m.draftErrors.noDraft);
        else this.succeed(run, draftId);
      }
    }
    // any finished turn may have freed the place a waiting run needs
    this.pump();
  }

  private succeed(run: DraftRun, draftId: number) {
    const done = this.runs.markDone(run.id, draftId);
    // Claude did the task: it is checked off in Claude's name
    if (run.task_id !== null && this.taskOpen(run.task_id)) this.claude.mod("calendar")?.tasks.update(run.task_id, { done: true });
    this.publish(done);
  }

  private fail(run: DraftRun, reason: string) {
    const failed = this.runs.markFailed(run.id, reason);
    console.warn(m.log.draftRunFailed(run.id, reason));
    // the request is not left as an open task, so the button that asked can ask again
    if (run.task_id !== null && this.taskOpen(run.task_id)) this.core.mod("calendar")?.tasks.remove(run.task_id);
    this.publish(failed);
  }

  /** A read of the calendar module's tasks table: the task still exists and is not done */
  private taskOpen(id: number): boolean {
    return !!this.core.mod("calendar") && !!row(this.core.ctx, "SELECT 1 AS x FROM tasks WHERE id = ? AND done_at IS NULL", id);
  }
}
