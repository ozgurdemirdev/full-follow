import { FFError, type Ctx } from "../context";
import type { ChatCard, CommentTargetDef, EntityHandler, EventName, EventPayload, Hook, ModAccess, ModuleDef, ModuleRuntime, TrashTypeDef, TypeRegistry } from "./types";

/** Identity helper: gives a module definition its type and checks the key shape. */
export function defineModule<const D extends ModuleDef>(def: D): D {
  if (!/^[a-z][a-z0-9-]*$/.test(def.key)) throw new FFError("validation", `module key "${def.key}" must be lower-case letters, digits and dashes`);
  return def;
}

export interface ModuleRegistry {
  has(key: string): boolean;
  /** installed modules, in registration order */
  list(): ModuleDef[];
  /** module keys given in the off list (known or not), sorted */
  off(): string[];
  /**
   * `coreHooks`: listeners for rules whose feature is not a module yet (drafts, ideas); they run before the modules' hooks of the same event,
   * which is where those features land once they are modules (their keys sort before pipeline's), so the effect order does not change when they move
   */
  bind(ctx: Ctx, coreHooks?: Record<string, Hook>): ModuleRuntime;
}

/**
 * Builds the registry from every module definition and an off list.
 * Duplicate keys are rejected even when one of them is off. Off modules are invisible:
 * not in `has`/`list`, not reachable through `mod`, and their hooks never run.
 */
/** Record types, aliases, labels, trash types and name lookups of the installed modules. A type or alias given twice is rejected. */
function buildTypes(installed: ModuleDef[]): TypeRegistry {
  const entities = new Map<string, EntityHandler>();
  const names = new Map<string, string>();
  const labels = new Map<string, string>();
  const trash: TrashTypeDef[] = [];
  const targets = new Map<string, CommentTargetDef>();
  const cards = new Map<string, ChatCard>();
  for (const def of installed) {
    for (const [type, handler] of Object.entries(def.entities ?? {})) {
      for (const name of [type, ...(handler.aliases ?? [])]) {
        if (names.has(name)) throw new FFError("validation", `record type name "${name}" is claimed twice (module "${def.key}")`);
        names.set(name, type);
      }
      entities.set(type, handler);
    }
    for (const [type, label] of Object.entries(def.contribute?.recordLabels ?? {})) labels.set(type, label);
    for (const t of def.contribute?.trashTypes ?? []) {
      labels.set(t.type, t.label);
      trash.push(t);
    }
    for (const [type, t] of Object.entries(def.contribute?.commentTargets ?? {})) targets.set(type, t);
    for (const [type, c] of Object.entries(def.contribute?.chatCards ?? {})) cards.set(type, c);
  }
  const inputRefs = [...entities].flatMap(([type, h]) => (h.ref ? [[type, `${type}_id`, type] as [string, string, string], ...Object.entries(h.refKeys ?? {}).map(([key, idKey]): [string, string, string] => [key, idKey, type])] : []));
  return {
    entity: (type) => entities.get(type),
    canonical: (name) => names.get(name),
    entityTypes: () => [...entities.keys()],
    label: (type) => labels.get(type),
    trashTypes: () => [...trash],
    ref: (type) => entities.get(type)?.ref,
    inputRefs: () => inputRefs,
    commentTarget: (type) => targets.get(type),
    commentTargets: () => [...targets.keys()],
    chatCard: (type) => cards.get(type),
    chatCardTypes: () => [...cards.keys()],
  };
}

export function createRegistry(defs: ModuleDef[] = [], off: string[] = []): ModuleRegistry {
  const seen = new Set<string>();
  for (const d of defs) {
    if (seen.has(d.key)) throw new FFError("validation", `duplicate module key "${d.key}"`);
    seen.add(d.key);
  }
  const offSet = new Set(off);
  const installed = defs.filter((d) => !offSet.has(d.key));
  const byKey = new Map(installed.map((d) => [d.key, d]));
  const types = buildTypes(installed);
  // the installed set never changes, so each kind of contribution is collected once
  const contributions = new Map<string, any[]>();
  const contrib: ModuleRuntime["contrib"] = (key) => {
    let list = contributions.get(key);
    if (!list) contributions.set(key, (list = installed.flatMap((def) => (def.contribute?.[key] === undefined ? [] : [def.contribute[key]]))));
    return list;
  };

  return {
    has: (key) => byKey.has(key),
    list: () => [...installed],
    off: () => [...offSet].sort(),
    bind(ctx, coreHooks = {}) {
      const apis = new Map<string, object>();
      const mod: ModAccess = (key) => {
        const def = byKey.get(key);
        if (!def?.api) return undefined;
        let api = apis.get(key);
        if (!api) {
          api = def.api(ctx);
          apis.set(key, api);
        }
        return api as any;
      };
      const emit = <N extends EventName>(name: N, payload: EventPayload<N>): string[] => {
        if (!ctx.sqlite.inTransaction) throw new Error(`emit("${name}") must run inside the caller's transaction`);
        const effects: string[] = [...(coreHooks[name]?.(ctx, payload) ?? [])];
        for (const def of installed) {
          const out = def.hooks?.[name]?.(ctx, payload);
          if (out) effects.push(...out);
        }
        return effects;
      };
      return { mod, emit, types, contrib };
    },
  };
}
