import { useEffect } from "react";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import { toast } from "../components/toast";
import type { Company, Detail, Person } from "../api/types";
import { forms } from "../messages.forms";

export interface Ref {
  id: number | null;
  text: string;
}
export const emptyRef: Ref = { id: null, text: "" };

/** Adres (e-posta ya da hesap) → form alanları: dönüştürmede önceden doldurulur */
export function fromContact(contact?: string) {
  const c = contact?.trim() ?? "";
  if (!c) return {};
  if (/linkedin\.com/i.test(c)) return { linkedin: c };
  if (/instagram\.com/i.test(c) || c.startsWith("@")) return { instagram: c };
  if (c.includes("@")) return { email: c };
  return { handle: c };
}

/** Fill the text of a chosen record's reference (opened with an id preset): one read of that record at `path` (`/people`), no list needed */
export function useRefText(ref: Ref, set: (r: Ref) => void, path: string) {
  const id = ref.id && !ref.text ? ref.id : null;
  const record = useQuery<Detail<{ name?: string; title?: string }>>(id ? `${path}/${id}` : null);
  const name = record.data?.row.name ?? record.data?.row.title;
  useEffect(() => {
    if (id && name) set({ id, text: name });
  }, [id, name, set]);
}

/**
 * Where a record made on the way to the save is written back: the form puts its id into the field at once, so when the save that follows fails
 * and the form is sent again, the retry reuses the record instead of creating a second one.
 */
export interface Writeback {
  person?: (r: Ref) => void;
  company?: (r: Ref) => void;
}

/** Firma: seçildiyse id, yazıldıysa yeni firma açar, boşsa null */
export async function ensureCompany(ref: Ref, writeback?: (r: Ref) => void): Promise<number | null> {
  if (ref.id) return ref.id;
  const name = ref.text.trim();
  if (!name) return null;
  const r = await run<Company>("post", "/companies", { name }, { silent: true });
  const id = r.row?.id ?? null;
  if (id) writeback?.({ id, text: name });
  return id;
}

/** Kişi: seçildiyse id, yazıldıysa (firmasıyla) yeni kişi açar */
export async function ensurePerson(
  ref: Ref,
  extra: { company?: Ref; referred_by?: Ref; tags?: string[]; next_follow_up_at?: string | null } = {},
  writeback: Writeback = {},
): Promise<number> {
  if (ref.id) return ref.id;
  const company_id = extra.company ? await ensureCompany(extra.company, writeback.company) : null;
  const name = ref.text.trim();
  const r = await run<Person>(
    "post",
    "/people",
    {
      name,
      company_id,
      referred_by_id: extra.referred_by?.id ?? null,
      tags: extra.tags,
      next_follow_up_at: extra.next_follow_up_at || undefined,
    },
    { silent: true },
  );
  if (!r.row) throw new Error(forms.helpers.personNotCreated);
  writeback.person?.({ id: r.row.id, text: name });
  return r.row.id;
}

/**
 * A step after the main save (a next step task, a first comment): the record is already saved, so when this fails the sheet still closes
 * and a toast says which part is missing. Never throws.
 */
export async function optionalStep(task: () => Promise<unknown>, failedText: string): Promise<void> {
  try {
    await task();
  } catch {
    toast(failedText, "error");
  }
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
