import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { CHAT_DEFAULTS, CHAT_NEW_TITLE, CHAT_TITLE_CHARS } from "../constants";
import { emit, FFError, parse, stamp, type Ctx } from "../context";
import { chat_messages, chat_sessions } from "../db/schema";
import { chatFinish, chatMessageCreate, chatMessagesQuery, chatSessionCreate, chatSessionsQuery, chatSessionUpdate } from "../schemas/chat";

/** First user message → title: first CHAT_TITLE_CHARS chars, cut at a word boundary */
function autoTitle(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= CHAT_TITLE_CHARS) return flat;
  const cut = flat.slice(0, CHAT_TITLE_CHARS);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).trim();
}

const encodeCursor = (at: string, id: number) => Buffer.from(`${at}|${id}`).toString("base64url");
function decodeCursor(c: string): { at: string; id: number } {
  const [at, id] = Buffer.from(c, "base64url").toString().split("|");
  if (!at || !Number.isInteger(Number(id))) throw new FFError("validation", "geçersiz cursor");
  return { at, id: Number(id) };
}

export function chatService(ctx: Ctx) {
  const sessionRow = (id: number) => {
    const r = ctx.db.select().from(chat_sessions).where(and(eq(chat_sessions.id, id), isNull(chat_sessions.deleted_at))).get();
    if (!r) throw new FFError("not_found", `sohbet #${id} bulunamadı`);
    return r;
  };
  const messageRow = (id: number) => {
    const r = ctx.db.select().from(chat_messages).where(eq(chat_messages.id, id)).get();
    if (!r) throw new FFError("not_found", `mesaj #${id} bulunamadı`);
    return r;
  };

  function createSession(input: unknown = {}) {
    const d = parse(chatSessionCreate, input);
    return ctx.db.transaction((tx) => {
      const r = tx.insert(chat_sessions).values({
        model: d.model ?? CHAT_DEFAULTS.model, effort: d.effort ?? CHAT_DEFAULTS.effort, cli_session_id: randomUUID(), ...stamp(ctx),
      }).returning().get();
      emit(tx, ctx, { type: "chat.created", summary: "Yeni sohbet açıldı", data: { chat_session_id: r.id } });
      return r;
    });
  }

  /** Keyset on (last_message_at, id) descending; a session without messages sorts by creation time */
  function listSessions(input: unknown = {}) {
    const q = parse(chatSessionsQuery, input);
    const key = sql`coalesce(${chat_sessions.last_message_at}, ${chat_sessions.created_at})`;
    const cur = q.cursor ? decodeCursor(q.cursor) : null;
    const list = ctx.db.select().from(chat_sessions)
      .where(and(isNull(chat_sessions.deleted_at), cur ? or(sql`${key} < ${cur.at}`, and(sql`${key} = ${cur.at}`, lt(chat_sessions.id, cur.id))) : undefined))
      .orderBy(desc(key), desc(chat_sessions.id)).limit(q.limit + 1).all();
    const items = list.slice(0, q.limit);
    const last = items[items.length - 1];
    return { items, next_cursor: list.length > q.limit && last ? encodeCursor(last.last_message_at ?? last.created_at, last.id) : null };
  }

  function updateSession(id: number, input: unknown) {
    const { title, ...rest } = parse(chatSessionUpdate, input);
    sessionRow(id);
    ctx.db.update(chat_sessions).set({ ...rest, ...(title ? { title, title_locked: true } : {}), updated_at: ctx.clock.now() }).where(eq(chat_sessions.id, id)).run();
    return sessionRow(id);
  }

  /** Soft delete: the session shows in the trash and can be restored */
  function deleteSession(id: number) {
    const cur = sessionRow(id);
    ctx.db.transaction((tx) => {
      const now = ctx.clock.now();
      tx.update(chat_sessions).set({ deleted_at: now, updated_at: now }).where(eq(chat_sessions.id, id)).run();
      emit(tx, ctx, { type: "chat.deleted", summary: `Sohbet silindi: ${cur.title}`, data: { chat_session_id: id } });
    });
    return { effects: [] as string[], trash: { type: "chat_session", id } };
  }

  function restoreSession(id: number) {
    const cur = ctx.db.select().from(chat_sessions).where(eq(chat_sessions.id, id)).get();
    if (!cur) throw new FFError("not_found", `sohbet #${id} bulunamadı`);
    ctx.db.update(chat_sessions).set({ deleted_at: null, updated_at: ctx.clock.now() }).where(eq(chat_sessions.id, id)).run();
    return { label: cur.title, effects: [`${cur.title} geri yüklendi`] };
  }

  /** `before` loads the page older than that message id; items come back oldest to newest */
  function listMessages(sessionId: number, input: unknown = {}) {
    const q = parse(chatMessagesQuery, input);
    sessionRow(sessionId);
    const list = ctx.db.select().from(chat_messages)
      .where(and(eq(chat_messages.session_id, sessionId), q.before ? lt(chat_messages.id, q.before) : undefined))
      .orderBy(desc(chat_messages.id)).limit(q.limit + 1).all();
    return { items: list.slice(0, q.limit).reverse(), has_more: list.length > q.limit };
  }

  /** Idempotent on (session, client_id): a retried send returns the existing row */
  function addUserMessage(sessionId: number, input: unknown) {
    const d = parse(chatMessageCreate, input);
    const session = sessionRow(sessionId);
    const dup = ctx.db.select().from(chat_messages).where(and(eq(chat_messages.session_id, sessionId), eq(chat_messages.client_id, d.client_id))).get();
    if (dup) return dup;
    return ctx.db.transaction((tx) => {
      const first = !tx.select({ id: chat_messages.id }).from(chat_messages).where(eq(chat_messages.session_id, sessionId)).get();
      const r = tx.insert(chat_messages).values({ session_id: sessionId, role: "user", body: d.body, state: "done", client_id: d.client_id, ...stamp(ctx) }).returning().get();
      const now = ctx.clock.now();
      tx.update(chat_sessions).set({
        last_message_at: now, updated_at: now,
        ...(first && !session.title_locked && session.title === CHAT_NEW_TITLE ? { title: autoTitle(d.body) } : {}),
      }).where(eq(chat_sessions.id, sessionId)).run();
      return r;
    });
  }

  function startAssistantMessage(sessionId: number) {
    sessionRow(sessionId);
    return ctx.db.insert(chat_messages).values({ session_id: sessionId, role: "assistant", state: "pending", ...stamp(ctx), created_by: "claude" }).returning().get();
  }

  function appendAssistantText(messageId: number, text: string) {
    ctx.db.update(chat_messages).set({ body: sql`${chat_messages.body} || ${text}`, state: "streaming", updated_at: ctx.clock.now() }).where(eq(chat_messages.id, messageId)).run();
  }

  function setAssistantTools(messageId: number, tools: { name: string; summary: string; ok: boolean }[]) {
    ctx.db.update(chat_messages).set({ tools_json: JSON.stringify(tools), updated_at: ctx.clock.now() }).where(eq(chat_messages.id, messageId)).run();
  }

  /** Message update and session totals in one transaction; a finished row is never counted twice */
  function finishAssistantMessage(messageId: number, input: unknown) {
    const d = parse(chatFinish, input);
    const cur = messageRow(messageId);
    if (cur.state === "done" || cur.state === "error" || cur.state === "stopped") return cur;
    return ctx.db.transaction((tx) => {
      const now = ctx.clock.now();
      const micros = d.cost_usd === undefined ? null : Math.round(d.cost_usd * 1_000_000);
      const r = tx.update(chat_messages).set({
        state: d.state, error: d.error ?? null, input_tokens: d.usage?.input_tokens ?? null, output_tokens: d.usage?.output_tokens ?? null,
        cost_usd_micros: micros, updated_at: now,
      }).where(eq(chat_messages.id, messageId)).returning().get();
      tx.update(chat_sessions).set({
        input_tokens_total: sql`${chat_sessions.input_tokens_total} + ${d.usage?.input_tokens ?? 0}`,
        output_tokens_total: sql`${chat_sessions.output_tokens_total} + ${d.usage?.output_tokens ?? 0}`,
        cost_usd_micros_total: sql`${chat_sessions.cost_usd_micros_total} + ${micros ?? 0}`,
        ...(d.context_tokens === undefined ? {} : { context_tokens: d.context_tokens }),
        last_message_at: now, updated_at: now,
      }).where(eq(chat_sessions.id, cur.session_id)).run();
      return r;
    });
  }

  function markCliStarted(sessionId: number) {
    ctx.db.update(chat_sessions).set({ cli_started: true }).where(eq(chat_sessions.id, sessionId)).run();
  }

  /** Boot cleanup: a run owned by a dead server can never finish */
  function failDanglingRuns(reason: string) {
    return ctx.db.update(chat_messages).set({ state: "error", error: reason, updated_at: ctx.clock.now() })
      .where(and(eq(chat_messages.role, "assistant"), inArray(chat_messages.state, ["pending", "streaming"]))).run().changes;
  }

  return {
    createSession, listSessions, getSession: sessionRow, updateSession, deleteSession, restoreSession, listMessages, getMessage: messageRow,
    addUserMessage, startAssistantMessage, appendAssistantText, setAssistantTools, finishAssistantMessage, markCliStarted, failDanglingRuns,
  };
}
