import type Database from "better-sqlite3";
import { z } from "zod";
import type { Actor } from "./constants";
import { LOCALE } from "./i18n";
import { localDate, nowIso } from "./dates";
import type { Db, Q } from "./db/client";
import { events } from "./db/schema";
import type { ModuleRuntime } from "./modules/types";

/** "http": a malformed request that is not about a record (a bad id in the URL) */
export type ErrorCode = "validation" | "not_found" | "rule" | "ambiguous" | "forbidden" | "duplicate" | "http";

/** Mükerrer kayıt: var olan kayıt (çöp kutusundaysa geri yüklenebilir) */
export interface DuplicateHit {
  type: "person" | "company" | "tag" | "sector" | "source";
  id: number;
  label: string;
  /** hangi alan çakıştı: e-posta, alan adı, firma adı, LinkedIn, Instagram, ad */
  field: string;
  in_trash: boolean;
}

export class FFError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public candidates?: { id: number; label: string }[],
    public duplicate?: DuplicateHit,
  ) {
    super(message);
    this.name = "FFError";
  }
}

export const fail = (code: ErrorCode, message: string): never => {
  throw new FFError(code, message);
};

export interface Clock {
  now(): string;
  today(): string;
}

export const systemClock: Clock = { now: nowIso, today: () => localDate() };

export interface Ctx extends ModuleRuntime {
  db: Db;
  sqlite: Database.Database;
  actor: Actor;
  clock: Clock;
}

/** System-owned fields are dropped silently (never taken from input); any other unknown field is a validation error. */
const SYSTEM_KEYS = ["id", "created_by", "created_at", "updated_at"];

/** Zod doğrulaması; hata mesajı okunur. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const data = input && typeof input === "object" && !Array.isArray(input)
    ? Object.fromEntries(Object.entries(input).filter(([k]) => !SYSTEM_KEYS.includes(k)))
    : input;
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const msg = r.error.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
  throw new FFError("validation", msg);
}

/** Ham SELECT (aynı bağlantı, açık transaction içinde de çalışır) */
export function rows<T = any>(ctx: Ctx, sql: string, ...params: unknown[]): T[] {
  return ctx.sqlite.prepare(sql).all(...params) as T[];
}
export function row<T = any>(ctx: Ctx, sql: string, ...params: unknown[]): T | undefined {
  return ctx.sqlite.prepare(sql).get(...params) as T | undefined;
}

/** Statements kept per connection for SQL that is a literal in code (never built from input), so the reads of hot paths do not prepare again. The set is bounded by the literals. */
const kept = new WeakMap<object, Map<string, Database.Statement>>();
function keep(ctx: Ctx, sql: string): Database.Statement {
  let byConnection = kept.get(ctx.sqlite);
  if (!byConnection) kept.set(ctx.sqlite, (byConnection = new Map()));
  let st = byConnection.get(sql);
  if (!st) byConnection.set(sql, (st = ctx.sqlite.prepare(sql)));
  return st;
}
/** Same as rows, for a literal SQL text: the statement is prepared once per connection */
export function keptRows<T = any>(ctx: Ctx, sql: string, ...params: unknown[]): T[] {
  return keep(ctx, sql).all(...params) as T[];
}
/** Same as row, for a literal SQL text: the statement is prepared once per connection */
export function keptRow<T = any>(ctx: Ctx, sql: string, ...params: unknown[]): T | undefined {
  return keep(ctx, sql).get(...params) as T | undefined;
}

export interface EventInput {
  type: string;
  summary: string;
  person_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
  data?: unknown;
}

/** Olay yazar. Çağıran, değişikliği yaptığı transaction içinde çağırmalıdır. */
export function emit(q: Q, ctx: Ctx, e: EventInput): void {
  q.insert(events).values({
    type: e.type,
    summary: e.summary,
    person_id: e.person_id ?? null,
    opportunity_id: e.opportunity_id ?? null,
    project_id: e.project_id ?? null,
    data: e.data === undefined ? null : JSON.stringify(e.data),
    created_by: ctx.actor,
    created_at: ctx.clock.now(),
  }).run();
}

export function stamp(ctx: Ctx) {
  const t = ctx.clock.now();
  return { created_at: t, updated_at: t, created_by: ctx.actor };
}

export function assertOzgur(ctx: Ctx, what: string): void {
  if (ctx.actor !== "ozgur") throw new FFError("forbidden", `${what} sadece Özgür tarafından yapılır`);
}

export const money = (n: number) => `${n.toLocaleString(LOCALE)}₺`;

/** Arama için: küçük harf, Türkçe karakter ve aksan duyarsız */
export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** limit/offset ile dilimleme */
export function page<T>(list: T[], limit = 20, offset = 0): { rows: T[]; total: number } {
  return { rows: list.slice(offset, offset + limit), total: list.length };
}

export interface ListOpts {
  q?: string;
  filter?: Record<string, any>;
  limit?: number;
  offset?: number;
}
