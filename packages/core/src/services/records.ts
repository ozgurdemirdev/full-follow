import { MODULE_TYPE_OWNER, RECORD_TYPES, TYPE_ALIASES, type RecordType } from "../constants";
import { FFError, type Ctx } from "../context";
import type { EntityHandler } from "../modules/types";
import { resolveInput, resolveRef, isRefType } from "./shared";

/** A record type core itself owns (the rest belong to feature modules and are looked up in the registry) */
export const isCoreType = (t: string): t is RecordType => (RECORD_TYPES as readonly string[]).includes(t);

/** Alias or name to the canonical type, for core types and the installed modules' types. Unknown types and types of modules that are not installed are a clear error. */
export function normalizeType(ctx: Ctx, t: string): string {
  const k = String(t).trim().toLowerCase();
  const type = TYPE_ALIASES[k] ?? ctx.types.canonical(k) ?? k;
  if (isCoreType(type) || ctx.types.entity(type)) return type;
  const owner = (MODULE_TYPE_OWNER as Record<string, string>)[type];
  if (owner) throw new FFError("validation", `"${type}" türü için "${owner}" modülü kurulu değil`);
  throw new FFError("validation", `bilinmeyen tür "${t}" (geçerli: ${[...RECORD_TYPES, ...ctx.types.entityTypes()].join(", ")})`);
}

/** id ya da isim → id (kişi, firma, fırsat, proje, kaynak için isim kabul edilir) */
export function resolveId(ctx: Ctx, type: string, id: string | number): number {
  if (isRefType(ctx, type)) return resolveRef(ctx, type, id);
  const n = Number(String(id).replace(/^#/, ""));
  if (!Number.isInteger(n) || n <= 0) throw new FFError("validation", `geçersiz id "${id}"`);
  return n;
}

/** One method of a module-owned type's handler; a type without it does not support the operation */
export function entityHandler<M extends "save" | "get" | "find" | "delete">(ctx: Ctx, type: string, method: M): NonNullable<EntityHandler[M]> {
  const fn = ctx.types.entity(type)?.[method];
  if (!fn) throw new FFError("validation", `${type} için ${method} desteklenmiyor`);
  return fn;
}

export { resolveInput };
