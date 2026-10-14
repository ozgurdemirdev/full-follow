import { FFError, type Ctx } from "../context";
import type { EventName, EventPayload, ModAccess, ModuleDef, ModuleRuntime } from "./types";

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
export function createRegistry(defs: ModuleDef[] = [], off: string[] = []): ModuleRegistry {
  const seen = new Set<string>();
  for (const d of defs) {
    if (seen.has(d.key)) throw new FFError("validation", `duplicate module key "${d.key}"`);
    seen.add(d.key);
  }
  const offSet = new Set(off);
  const installed = defs.filter((d) => !offSet.has(d.key));
  const byKey = new Map(installed.map((d) => [d.key, d]));

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
      return { mod, emit };
    },
  };
}
