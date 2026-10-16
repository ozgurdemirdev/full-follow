import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { assertOwner, FFError, schema, stamp, type ChatPermission, type ChatPermissionsApi, type Ctx } from "@fullfollow/core";
import { PERMISSION_LIMITS } from "../constants";
import { m } from "../messages";

const { chat_messages, chat_permissions, chat_sessions } = schema;
const RUNNING = ["pending", "streaming"] as const;

/**
 * The confirmations of the panel chat. Every change of state is one conditional UPDATE on `state = 'pending'`, so an answer and the
 * timeout (or the end of the run) never both win: whichever writes first settles the row, the other sees it is no longer pending.
 */
export function permissionsService(ctx: Ctx): ChatPermissionsApi {
  const get = (id: number): ChatPermission => {
    const r = ctx.db.select().from(chat_permissions).where(eq(chat_permissions.id, id)).get();
    if (!r) throw new FFError("not_found", m.permission.notFound(id));
    return r as ChatPermission;
  };

  function ask(sessionId: number, toolName: string, input: unknown, summary: string): ChatPermission {
    if (!ctx.db.select({ id: chat_sessions.id }).from(chat_sessions).where(eq(chat_sessions.id, sessionId)).get()) {
      throw new FFError("not_found", m.errors.sessionNotFound(sessionId));
    }
    const running = ctx.db.select({ id: chat_messages.id }).from(chat_messages)
      .where(and(eq(chat_messages.session_id, sessionId), eq(chat_messages.role, "assistant"), inArray(chat_messages.state, [...RUNNING])))
      .orderBy(desc(chat_messages.id)).get();
    return ctx.db.insert(chat_permissions).values({
      session_id: sessionId, message_id: running?.id ?? null, tool_name: toolName, input_json: JSON.stringify(input ?? {}), summary, ...stamp(ctx),
    }).returning().get() as ChatPermission;
  }

  /** pending → `state` for the rows `where` picks (every pending row without it); the rows that changed */
  const settle = (where: SQL | undefined, state: ChatPermission["state"]) => {
    const now = ctx.clock.now();
    return ctx.db.update(chat_permissions).set({ state, answered_at: now, updated_at: now })
      .where(and(where, eq(chat_permissions.state, "pending"))).returning().all() as ChatPermission[];
  };

  function answer(id: number, allow: boolean): ChatPermission {
    assertOwner(ctx, m.permission.answerAction);
    get(id);
    const [row] = settle(eq(chat_permissions.id, id), allow ? "allowed" : "denied");
    if (!row) throw new FFError("rule", m.permission.notPending(id));
    return row;
  }

  const expire = (id: number) => settle(eq(chat_permissions.id, id), "expired").length > 0;

  const pending = () => ctx.db.select().from(chat_permissions).where(eq(chat_permissions.state, "pending")).orderBy(asc(chat_permissions.id)).all() as ChatPermission[];

  function ofSession(sessionId: number): ChatPermission[] {
    const newest = ctx.db.select().from(chat_permissions).where(eq(chat_permissions.session_id, sessionId))
      .orderBy(desc(chat_permissions.id)).limit(PERMISSION_LIMITS.listMax).all() as ChatPermission[];
    return newest.reverse();
  }

  const cancel = (sessionId?: number) => settle(sessionId === undefined ? undefined : eq(chat_permissions.session_id, sessionId), "cancelled");

  return { ask, get, answer, expire, pending, ofSession, cancel };
}
