import { RECORD_TYPES, TYPE_ALIASES, type RecordType } from "../constants";
import { FFError, type Ctx } from "../context";
import { resolveInput, resolveRef, isRefType } from "./shared";

export function normalizeType(t: string): RecordType {
  const k = String(t).trim().toLowerCase();
  const type = (TYPE_ALIASES[k] ?? k) as RecordType;
  if (!RECORD_TYPES.includes(type)) throw new FFError("validation", `bilinmeyen tür "${t}" (geçerli: ${RECORD_TYPES.join(", ")})`);
  return type;
}

/** id ya da isim → id (kişi, firma, fırsat, proje, kaynak için isim kabul edilir) */
export function resolveId(ctx: Ctx, type: RecordType, id: string | number): number {
  if (isRefType(type)) return resolveRef(ctx, type, id);
  const n = Number(String(id).replace(/^#/, ""));
  if (!Number.isInteger(n) || n <= 0) throw new FFError("validation", `geçersiz id "${id}"`);
  return n;
}

export { resolveInput };
