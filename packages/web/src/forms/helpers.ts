import { run } from "../api/actions";
import type { Company, Person } from "../api/types";

export interface Ref {
  id: number | null;
  text: string;
}
export const emptyRef: Ref = { id: null, text: "" };

/** Firma: seçildiyse id, yazıldıysa yeni firma açar, boşsa null */
export async function ensureCompany(ref: Ref): Promise<number | null> {
  if (ref.id) return ref.id;
  const name = ref.text.trim();
  if (!name) return null;
  const r = await run<Company>("post", "/companies", { name }, { silent: true });
  return r.row?.id ?? null;
}

/** Kişi: seçildiyse id, yazıldıysa (firmasıyla) yeni kişi açar */
export async function ensurePerson(
  ref: Ref,
  extra: { company?: Ref; referred_by?: Ref; tags?: string[]; next_follow_up_at?: string | null } = {},
): Promise<number> {
  if (ref.id) return ref.id;
  const company_id = extra.company ? await ensureCompany(extra.company) : null;
  const r = await run<Person>(
    "post",
    "/people",
    {
      name: ref.text.trim(),
      company_id,
      referred_by_id: extra.referred_by?.id ?? null,
      tags: extra.tags,
      next_follow_up_at: extra.next_follow_up_at || undefined,
    },
    { silent: true },
  );
  if (!r.row) throw new Error("kişi açılamadı");
  return r.row.id;
}

/** datetime-local değeri (yerel saat) → ISO */
export const localToIso = (v: string) => (v ? new Date(v).toISOString() : undefined);
export function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
/** ISO → datetime-local değeri (yerel saat) */
export function toLocal(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
