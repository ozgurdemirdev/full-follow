import type { z } from "zod";
import type { Ctx, ListOpts } from "../context";
import type { ModuleApis, ModuleEvents } from "../contracts";

/** Result shape shared by every write: the row, human readable effects, and a trash handle on delete. */
export interface SaveResult {
  row?: any;
  effects: string[];
  /** on delete: how to undo it (the "Geri al" toast) */
  trash?: { type: string; id: number };
}

/** Event names known to the contracts, plus any other string. */
export type EventName = Extract<keyof ModuleEvents, string> | (string & {});
export type EventPayload<N extends string> = N extends keyof ModuleEvents ? ModuleEvents[N] : unknown;

/** Runs inside the transaction of the code that emitted the event. Returns effect strings; throwing rolls everything back. */
export type Hook = (ctx: Ctx, payload: any) => string[] | void;

/** Typed access to another module's API; `undefined` when that module is not installed. */
export type ModAccess = <K extends string>(key: K) => (K extends keyof ModuleApis ? ModuleApis[K] : unknown) | undefined;

/** Where a record type keeps its display name: lets `id or name` input resolve to an id, and a `<type>` input key become `<type>_id`. */
export interface EntityRef {
  table: string;
  /** column holding the display name */
  col: string;
  /** Turkish name used in error messages */
  label: string;
}

/**
 * A record type a module owns: its save / get / find / delete handlers and how the generic dispatch (save, find, get, delete,
 * restore, `name or id` references) treats it. The key under `ModuleDef.entities` is the canonical type name.
 */
export interface EntityHandler {
  /** runs on the input of `save` before names are resolved to ids (a person saved with a company name opens the company) */
  prepare?(ctx: Ctx, data: Record<string, any>): Record<string, any>;
  save?(ctx: Ctx, data: Record<string, any>, id?: number): SaveResult;
  /** the record's row (same shape as its list rows), or undefined when it does not exist */
  get?(ctx: Ctx, id: number): Record<string, any> | undefined;
  find?(ctx: Ctx, opts: ListOpts): { rows: any[]; total: number };
  delete?(ctx: Ctx, id: number): SaveResult;
  /** a stage change (`move` of the MCP, the board): `input` is `{ stage, reason?, position? }` */
  move?(ctx: Ctx, id: number, input: { stage: string; reason?: string; position?: number }): SaveResult;
  /** other names for this type, lower case (Turkish names, plurals) */
  aliases?: string[];
  /** set when records of this type can be given by name */
  ref?: EntityRef;
  /** other input keys that name a record of this type: key to the id column it becomes (`referred_by` to `referred_by_id`) */
  refKeys?: Record<string, string>;
  /** set when `save` accepts lists: the label in the "duplicates skipped" event and the duplicate keys of one input item */
  bulk?: { label: string; keys(item: Record<string, any>): string[] };
  /** relation names `get(..., with)` accepts for this type */
  related?: string[];
}

export interface SearchHit {
  type: string;
  id: number;
  label: string;
}

export interface TrashTypeDef {
  type: string;
  label: string;
}

/**
 * A list the module loads for `get(type, id, with: [name])` (for example the tasks of a person); `by` is `{ <type>_id: id }` of the record asked for
 * and `rec` is that record's own row.
 */
export interface RelationDef {
  /** record types that accept this relation */
  on: string[];
  load(ctx: Ctx, by: Record<string, number>, limit: number, rec: Record<string, any>): any[];
}

/** A record type comments can hang on: its table, how its label reads in a thread, and the person, opportunity or project its events link to */
export interface CommentTargetDef {
  table: string;
  /** thread title of one record (`#id` when the record is gone) */
  label(ctx: Ctx, id: number): string;
  /** event links of one record (defaults to none) */
  link?(ctx: Ctx, id: number): { person_id?: number | null; opportunity_id?: number | null; project_id?: number | null };
}

/** What the panel chat shows on a record chip of this type: a small plain object (title and a few fields); `personId` is the `@person` of a template key */
export type ChatCard = (ctx: Ctx, id: number, personId?: number) => Record<string, any>;

/** What a module adds to the shared views. Each function returns only its own part; the host merges them. */
export interface Contributions {
  /** sections of the Today view, by key; `limit` is the row cap per section */
  today?: (ctx: Ctx, opts: { limit: number }) => Record<string, unknown>;
  /** relation name to its loader */
  relations?: Record<string, RelationDef>;
  /** lists and labels the web forms read from `/api/meta` */
  meta?: Record<string, unknown>;
  report?: (ctx: Ctx, range: { from: string; to: string }) => Record<string, unknown>;
  review?: (ctx: Ctx, week: string) => Record<string, unknown>;
  search?: (ctx: Ctx, q: string, limit: number) => SearchHit[];
  trashTypes?: TrashTypeDef[];
  /** record type to its Turkish display name */
  recordLabels?: Record<string, string>;
  /** event type to its Turkish timeline label */
  timelineLabels?: Record<string, string>;
  /** record types comments can hang on (`target_type` of a comment) */
  commentTargets?: Record<string, CommentTargetDef>;
  /** record types the panel chat can show as a chip (`<type>:<id>` keys) */
  chatCards?: Record<string, ChatCard>;
}

/** Row of a record, as the MCP formatters receive it */
type Row = Record<string, any>;

/** Helpers the MCP host hands to a module's formatters, so modules format like the core types do */
export interface McpFormat {
  /** ISO date to dd.mm (dd.mm.yy for other years) */
  d(iso?: string | null): string;
  /** amount with the lira sign */
  tl(n?: number | null): string;
  cut(s: string | null | undefined, n?: number): string;
  /** actor to its display name */
  who(a?: string): string;
  /** parts joined with " · ", empty ones dropped */
  join(...parts: (string | number | null | undefined | false)[]): string;
  label(key: string): string;
  /** one line of any record type */
  line(type: string, r: Row): string;
  /** a titled list section of a today style view (empty text when the list is empty) */
  section(title: string, type: string, res: { rows: Row[]; total: number }): string;
  /** the confirmation line of a write: `ok · <kind> #<id> <extra> · <effect> · ...` */
  ok(kind: string, id: number | undefined, effects?: string[], extra?: string): string;
}

/** How one record type is written in MCP output */
export interface McpEntityDoc {
  /** short Turkish name used in confirmations ("görev") */
  kind: string;
  /** one line, as in lists and at the head of a get */
  line(r: Row, f: McpFormat): string;
  /** extra lines of a get, after the extra fields */
  details?(r: Row, f: McpFormat): string[];
  /** the type has a page in the panel (what `open` may show) */
  openable?: boolean;
}

/** Text spliced into a generic tool's description; fragments are sorted by `at` (core's own are 100, 200, ...) and joined as they are */
export interface DocFragment {
  at: number;
  text: string;
}

/** A tool only this module has */
export interface McpToolDef {
  name: string;
  description: string;
  input: Record<string, z.ZodType>;
  run(ctx: Ctx, args: any, f: McpFormat): string;
}

/** What a module adds to the MCP server: its record types' output, its own tools, and its parts of the shared texts */
export interface McpDef {
  entities?: Record<string, McpEntityDoc>;
  tools?: McpToolDef[];
  /** tool name to the fragments added to its description */
  docs?: Record<string, DocFragment[]>;
  /** sections of the `today` text, sorted by `at` among core's (100, 200, ...) */
  today?: { at: number; render(t: any, f: McpFormat): string }[];
  /** lines of the marketing part of the `report` text, sorted by `at` */
  marketing?: { at: number; render(m: any, f: McpFormat): string[] }[];
  /** relation name (get with) to the record type its rows are written as */
  relations?: Record<string, string>;
}

export interface ModuleDef {
  /** unique, lower-case key (matches `"fullfollow": { "module": "<key>" }` in the package) */
  key: string;
  /** Turkish name shown to the user */
  label: string;
  /** optional dependencies on other module keys; informational, never a hard import */
  uses?: string[];
  /** the API exposed through `ctx.mod(key)`; created lazily, once per context */
  api?: (ctx: Ctx) => object;
  entities?: Record<string, EntityHandler>;
  /** event name to the hook run when that event is emitted */
  hooks?: Record<string, Hook>;
  contribute?: Contributions;
  /** MCP side: formatters, tools and description fragments */
  mcp?: McpDef;
}

/** What the installed modules say about record types; the generic dispatch (save, find, get, delete, restore, refs) reads it. */
export interface TypeRegistry {
  /** the handler of a module-owned record type */
  entity(type: string): EntityHandler | undefined;
  /** alias or type name to the canonical module type */
  canonical(name: string): string | undefined;
  /** canonical names of every module-owned record type, in registration order */
  entityTypes(): string[];
  /** Turkish display name of a module-owned type (record labels and trash types) */
  label(type: string): string | undefined;
  /** module-owned types whose deleted records go to the trash */
  trashTypes(): TrashTypeDef[];
  /** how a module-owned type is looked up by name */
  ref(type: string): EntityRef | undefined;
  /** every module-owned input key that names a record: the key, the id column it becomes and the type it looks up */
  inputRefs(): [key: string, idKey: string, type: string][];
  /** comment target of a module-owned type */
  commentTarget(type: string): CommentTargetDef | undefined;
  /** module-owned record types comments can hang on, in registration order */
  commentTargets(): string[];
  /** chip data of a module-owned type for the panel chat */
  chatCard(type: string): ChatCard | undefined;
  /** module-owned record types the chat can show as a chip, in registration order */
  chatCardTypes(): string[];
}

/** A registry bound to one context: what services use as `ctx.mod`, `ctx.emit` and `ctx.types`. */
export interface ModuleRuntime {
  mod: ModAccess;
  emit<N extends EventName>(name: N, payload: EventPayload<N>): string[];
  types: TypeRegistry;
  /** the installed modules' contributions of one kind, in registration order */
  contrib<K extends keyof Contributions>(key: K): NonNullable<Contributions[K]>[];
}
