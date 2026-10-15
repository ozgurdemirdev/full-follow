import { BULK_SKIPPED_EVENT } from "../constants";
import { emit, FFError, row, type Ctx, type DuplicateHit } from "../context";
import { companyKeys, KEY_LABEL, personKeys, type KeyKind } from "../keys";
import { m } from "../messages";
import { trashKeyHit } from "./trash";

/** Anahtar sütunu → tür ("email_key" → "email") */
const KIND_OF: Record<string, KeyKind> = { email_key: "email", domain_key: "domain", name_key: "name", instagram_key: "instagram", linkedin_key: "linkedin" };
/** Her anahtarın arandığı tablolar: e-posta ve hesaplar kişi ile firma arasında da tektir */
const WHERE: Record<KeyKind, ("people" | "companies")[]> = {
  email: ["people", "companies"], instagram: ["people", "companies"], linkedin: ["people", "companies"], domain: ["companies"], name: ["companies"],
};

type KeyCols = Partial<Record<keyof typeof KIND_OF, string | null>>;

/** Kayıt anahtarları → "email:a@b.com" listesi (çöp kutusu satırına yazılır) */
export const keyList = (k: KeyCols) =>
  Object.entries(k).filter(([, v]) => v).map(([col, v]) => `${KIND_OF[col]}:${v}`);

/**
 * Mükerrer kontrolü: verilen anahtarlardan biri başka bir kişi/firmada (ya da çöp kutusunda) varsa hata.
 * self: güncellenen kaydın kendisi (kendisiyle çakışmaz). Ad soyad tekrar edebilir, kontrol edilmez.
 */
export function assertUnique(ctx: Ctx, keys: KeyCols, self?: { type: "person" | "company"; id: number }, skipTrash = false) {
  for (const [col, value] of Object.entries(keys)) {
    if (!value) continue;
    const kind = KIND_OF[col];
    for (const table of WHERE[kind]) {
      const type = table === "people" ? "person" : "company";
      const hit = row<{ id: number; name: string }>(ctx, `SELECT id, name FROM ${table} WHERE ${col} = ?${self?.type === type ? " AND id != ?" : ""} LIMIT 1`,
        value, ...(self?.type === type ? [self.id] : []));
      if (hit) throw duplicate({ type, id: hit.id, label: hit.name, field: KEY_LABEL[kind], in_trash: false });
    }
  }
  const t = skipTrash ? undefined : trashKeyHit(ctx, keyList(keys));
  if (t) {
    const kind = t.key.split(":")[0] as KeyKind;
    throw duplicate({ type: t.type as "person" | "company", id: t.record_id, label: t.label, field: KEY_LABEL[kind], in_trash: true });
  }
}

/**
 * Duplicates skipped by one bulk save (people and companies) become a single event: the skipped count and the keys of the
 * skipped records (`label` is the Turkish name of the type, `keys` the duplicate keys of the skipped items). The daily goal row reads its "duplicates skipped" count from here. Called inside the bulk save transaction.
 */
export function recordSkipped(ctx: Ctx, type: string, label: string, keys: string[], count: number) {
  if (!count) return;
  emit(ctx.db, ctx, {
    type: BULK_SKIPPED_EVENT,
    summary: m.dupe.bulkSkipped(count, label),
    data: { record_type: type, count, keys },
  });
}

/** Çöp kutusundan geri gelecek kaydın anahtarları ("email:a@b.com") etkin bir kayıtta kullanılıyor mu */
export function assertKeysFree(ctx: Ctx, keys: string[]) {
  const cols: KeyCols = {};
  for (const k of keys) {
    const i = k.indexOf(":");
    (cols as Record<string, string>)[`${k.slice(0, i)}_key`] = k.slice(i + 1);
  }
  assertUnique(ctx, cols, undefined, true);
}

export function duplicate(hit: DuplicateHit): FFError {
  const what = { person: m.noun.person, company: m.noun.company, tag: m.noun.tag, sector: m.noun.sector, source: m.noun.source }[hit.type];
  return new FFError("duplicate", m.dupe.exists(hit.field, what, hit.id, hit.label, hit.in_trash), undefined, hit);
}

export { personKeys, companyKeys };
