import type { z } from "zod";
import type { Actor } from "../constants";
import type { Ctx, ListOpts } from "../context";
import type { FeedKind, ModuleApis, ModuleEvents } from "../contracts";

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
  /** labelled links (roadmap, proposal deck, Figma, repo) can hang on this record type */
  links?: boolean;
  /** uploaded files can hang on this record type */
  files?: boolean;
  /** the record whose links also show on this record's link list (a project shows the links of its opportunity); `from` is the word those rows are marked with */
  linksFrom?(ctx: Ctx, id: number): { type: string; id: number; from: string } | undefined;
}

/** What the panel chat shows on a record chip of this type: a small plain object (title and a few fields); `personId` is the `@person` of a template key */
export type ChatCard = (ctx: Ctx, id: number, personId?: number) => Record<string, any>;

/**
 * Work a module wants done on a schedule while the server runs. The server host starts it, stops it on shutdown and never runs one job twice at the same time
 * (a run that is still going makes the next tick skip). `app` is the app acting as Claude, because scheduled work is Claude's, never a typed-in identity.
 */
/** What a job gets: the app acting as Claude, reduced to what scheduled work needs (the composed app satisfies it) */
export interface JobApp {
  actor: Actor;
  mod: ModAccess;
  ctx: Ctx;
}

export interface JobDef {
  name: string;
  everyMs: number;
  /** delay before the first run (default: everyMs) */
  firstRunMs?: number;
  /** the job is left out when this returns false (a switch in the environment); default: always on */
  enabled?(): boolean;
  run(app: JobApp): void | Promise<void>;
}

/** How one event type shows in the timeline module's global feed */
export interface TimelineEventDef {
  kind: FeedKind;
  /** key of the event's data that holds the amount in TL (payments) */
  amount?: string;
  /** the row the event's data points at (`data.<key>` is its id), for the links the event itself does not carry: a table with person_id, company_id, opportunity_id and project_id columns */
  row?: { key: string; table: string };
}

/** Records a module hides in place (a `deleted_at` column) instead of moving them to the trash table: the trash lists them and brings them back */
export interface SoftTrashDef {
  /** the type the trash row and the restore call carry */
  type: string;
  /** Turkish name of the type */
  label: string;
  list(ctx: Ctx): { id: number; label: string; deleted_at: string }[];
  restore(ctx: Ctx, id: number): { label: string; effects: string[] };
}

/** The ids a record leads to: what `link()` fills in on an event that names only the record */
export interface LinkedIds {
  person_id?: number | null;
  opportunity_id?: number | null;
}

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
  /** figures computed from the settings values, added to what `GET /api/settings` returns (the price floor) */
  settingsView?: (ctx: Ctx, settings: Record<string, unknown>) => Record<string, unknown>;
  /** extra count columns of the sources list: column name to the count per source id (the opportunities of a source) */
  sourceCounts?: (ctx: Ctx) => Record<string, Map<number, number>>;
  /** event type to how it shows in the timeline's global feed (events of a type nobody lists stay out of the feed) */
  timelineKinds?: Record<string, TimelineEventDef>;
  /** records the module hides in place; they show in the trash and restore from it */
  softTrash?: SoftTrashDef;
  /** scheduled work for the server host */
  jobs?: JobDef[];
  /** what a project or an opportunity leads to (an event that names only the project also carries its opportunity and person); `link()` asks the installed module that serves the key */
  recordLinks?: { project_id?: (ctx: Ctx, id: number) => LinkedIds | undefined; opportunity_id?: (ctx: Ctx, id: number) => LinkedIds | undefined };
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
  /** the lines the installed modules contribute to the marketing part of the report (`marketing` in their MCP part), unsorted */
  marketingParts(): { at: number; render(m: any, f: McpFormat): string[] }[];
  /** the Instagram and LinkedIn line of a person or company (empty when it has neither); a module that shows them adds both fields to its `skip` */
  socials(r: Row): string[];
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
  /** a plain text, or fragments continued by the `docs` fragments the other modules contribute for this tool (the `report` tool) */
  description: string | DocFragment[];
  input: Record<string, z.ZodType>;
  run(ctx: Ctx, args: any, f: McpFormat): string;
}

/** What a module adds to the MCP server: its record types' output, its own tools, and its parts of the shared texts */
export interface McpDef {
  /** row fields of this module's records that `get` leaves out of its extra lines (the record's own line already shows them) */
  skip?: string[];
  entities?: Record<string, McpEntityDoc>;
  tools?: McpToolDef[];
  /** tool name to the fragments added to its description */
  docs?: Record<string, DocFragment[]>;
  /** sections of the `today` text, sorted by `at` among core's (100, 200, ...); `head` puts the text with the lines before the sections (after the week line) instead */
  today?: { at: number; head?: boolean; render(t: any, f: McpFormat): string }[];
  /** lines of the marketing part of the `report` text, sorted by `at` */
  marketing?: { at: number; render(m: any, f: McpFormat): string[] }[];
  /** relation name (get with) to the record type its rows are written as */
  relations?: Record<string, string>;
  /** relation name to the one line its rows make, for a relation whose rows are not records (the touch counts per channel) */
  relationLines?: Record<string, (rows: Row[], f: McpFormat) => string>;
  /** extra data the `today` tool adds to the Today view before its text is written (the follow-up drafts the drafts module prepares); runs on every call */
  todayData?: (mod: ModAccess) => Record<string, unknown>;
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
  /** event name to the place of this module's hook among the others of that event: lower runs first, the default is 0, ties keep module key order */
  hookOrder?: Record<string, number>;
  contribute?: Contributions;
  /** MCP side: formatters, tools and description fragments */
  mcp?: McpDef;
  /** GET paths without parameters that must answer 200 while the module is installed (`npm run check:modules` requests them against a seeded database) */
  smoke?: string[];
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
  /** record types labelled links can hang on, in registration order */
  linkTargets(): string[];
  /** record types uploaded files can hang on, in registration order */
  fileTargets(): string[];
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
  /** keys of the installed modules (the `modules_hidden` setting accepts only these) */
  moduleKeys: readonly string[];
  /** the installed modules' contributions of one kind, in registration order */
  contrib<K extends keyof Contributions>(key: K): NonNullable<Contributions[K]>[];
}
