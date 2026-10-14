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

/** Save / get / find / delete handlers for a record type a module owns. */
export interface EntityHandler {
  save?(ctx: Ctx, data: Record<string, any>, id?: number): SaveResult;
  get?(ctx: Ctx, id: number, withRel: string[], relLimit?: number): unknown;
  find?(ctx: Ctx, opts: ListOpts): unknown;
  delete?(ctx: Ctx, id: number): SaveResult;
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

/** What a module adds to the shared views. Each function returns only its own part; the host merges them. */
export interface Contributions {
  today?: (ctx: Ctx) => Record<string, unknown>;
  report?: (ctx: Ctx, range: { from: string; to: string }) => Record<string, unknown>;
  review?: (ctx: Ctx, week: string) => Record<string, unknown>;
  search?: (ctx: Ctx, q: string, limit: number) => SearchHit[];
  trashTypes?: TrashTypeDef[];
  /** record type to its Turkish display name */
  recordLabels?: Record<string, string>;
  /** event type to its Turkish timeline label */
  timelineLabels?: Record<string, string>;
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
}

/** A registry bound to one context: what services use as `ctx.mod` and `ctx.emit`. */
export interface ModuleRuntime {
  mod: ModAccess;
  emit<N extends EventName>(name: N, payload: EventPayload<N>): string[];
}
