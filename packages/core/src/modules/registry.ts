import { FFError, type Ctx } from "../context";
import type { EntityHandler, EntityRef, EventName, EventPayload, ModAccess, ModuleDef, ModuleRuntime, TrashTypeDef, TypeRegistry } from "./types";

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
  bind(ctx: Ctx): ModuleRuntime;
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
  }
  const refs = [...entities].flatMap(([type, h]) => (h.ref ? [[type, h.ref] as [string, EntityRef]] : []));
  return {
    entity: (type) => entities.get(type),
    canonical: (name) => names.get(name),
    entityTypes: () => [...entities.keys()],
    label: (type) => labels.get(type),
    trashTypes: () => [...trash],
    ref: (type) => entities.get(type)?.ref,
    refs: () => refs,
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

  return {
    has: (key) => byKey.has(key),
    list: () => [...installed],
    off: () => [...offSet].sort(),
    bind(ctx) {
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
        const effects: string[] = [];
        for (const def of installed) {
          const out = def.hooks?.[name]?.(ctx, payload);
          if (out) effects.push(...out);
        }
        return effects;
      };
      const contrib: ModuleRuntime["contrib"] = (key) => installed.flatMap((def) => (def.contribute?.[key] === undefined ? [] : [def.contribute[key] as any]));
      return { mod, emit, types, contrib };
    },
  };
}
