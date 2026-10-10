// Mükerrer kontrol anahtarları: aynı e-posta, alan adı, firma adı, LinkedIn ve Instagram ikinci kez girilmesin.
// Büyük/küçük harf, boşluk, Türkçe karakter, www/https ve adres biçimi farkları aynı anahtara iner.
import type Database from "better-sqlite3";

/** küçük harf, Türkçe karakter ve aksan duyarsız */
function fold(s: string): string {
  return s.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const blank = (s: string | null | undefined) => !s || !String(s).trim();

/** Adresten şema, www., sorgu ve sondaki / atılır: "HTTPS://www.Örnek.com/a/" → "ornek.com/a" */
function bareUrl(s: string): string {
  return fold(s.trim()).replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

export function emailKey(s: string | null | undefined): string | null {
  if (blank(s)) return null;
  return fold(String(s)).replace(/\s+/g, "").replace(/^mailto:/, "");
}

/** Web sitesi ya da e-posta → alan adı ("https://www.abc.com.tr/iletisim" → "abc.com.tr") */
export function domainKey(s: string | null | undefined): string | null {
  if (blank(s)) return null;
  const v = String(s).includes("@") && !String(s).includes("/") ? String(s).split("@").pop()! : String(s);
  return bareUrl(v).split("/")[0].replace(/^www\./, "") || null;
}

/** Şirket türü ekleri: sondan atılır ("ABC Yazılım Ltd. Şti." = "ABC Yazılım") */
const LEGAL_SUFFIX = new Set(["ltd", "sti", "limited", "sirketi", "as", "a", "s", "anonim", "tic", "ticaret", "san", "sanayi", "ve", "inc", "llc", "gmbh", "co", "corp"]);

/** Firma adı: noktalama, boşluk ve sondaki şirket türü ekleri yok sayılır */
export function nameKey(s: string | null | undefined): string | null {
  if (blank(s)) return null;
  const words = fold(String(s)).split(/[^a-z0-9]+/).filter(Boolean);
  const all = words.join("");
  while (words.length > 1 && LEGAL_SUFFIX.has(words[words.length - 1])) words.pop();
  return words.join("") || all || null;
}

/** Instagram: adres ya da @kullanıcı → kullanıcı adı */
export function instagramKey(s: string | null | undefined): string | null {
  if (blank(s)) return null;
  const v = bareUrl(String(s).replace(/^@/, ""));
  return (v.startsWith("instagram.com/") ? v.slice("instagram.com/".length).split("/")[0] : v.split("/")[0]).replace(/^@/, "") || null;
}

/** LinkedIn: adres → "in/ozgur" ya da "company/abc"; düz kullanıcı adı "in/" sayılır */
export function linkedinKey(s: string | null | undefined): string | null {
  if (blank(s)) return null;
  const v = bareUrl(String(s)).replace(/^[a-z]{2}\.linkedin\.com\//, "linkedin.com/");
  const path = v.startsWith("linkedin.com/") ? v.slice("linkedin.com/".length) : v;
  const [kind, id] = path.split("/");
  if (id && ["in", "company", "school", "showcase"].includes(kind)) return `${kind}/${id}`;
  return path.includes("/") ? path : `in/${path}`;
}

/**
 * Serbest adres (soğuk e-posta adresi ya da hesap) → anahtar: e-posta, Instagram ya da LinkedIn.
 * Sadece adresli temasın sonradan açılan kişi/firmaya bağlanması için.
 */
export function contactKey(s: string | null | undefined): string | null {
  if (blank(s)) return null;
  const v = String(s).trim();
  if (/linkedin\.com/i.test(v)) return `linkedin:${linkedinKey(v)}`;
  if (/instagram\.com/i.test(v) || v.startsWith("@")) return `instagram:${instagramKey(v)}`;
  if (v.includes("@")) return `email:${emailKey(v)}`;
  return `handle:${fold(v).replace(/\s+/g, "")}`;
}

export type KeyKind = "email" | "domain" | "name" | "instagram" | "linkedin";
export const KEY_LABEL: Record<KeyKind, string> = { email: "e-posta", domain: "alan adı", name: "firma adı", instagram: "Instagram", linkedin: "LinkedIn" };

/** Kişinin anahtar sütunları */
export function personKeys(p: { email?: string | null; instagram?: string | null; linkedin?: string | null }) {
  return { email_key: emailKey(p.email), instagram_key: instagramKey(p.instagram), linkedin_key: linkedinKey(p.linkedin) };
}

/** Firmanın anahtar sütunları */
export function companyKeys(c: { name?: string | null; website?: string | null; email?: string | null; instagram?: string | null; linkedin?: string | null }) {
  return {
    name_key: nameKey(c.name), domain_key: domainKey(c.website), email_key: emailKey(c.email),
    instagram_key: instagramKey(c.instagram), linkedin_key: linkedinKey(c.linkedin),
  };
}

/**
 * Anahtarı boş kalmış eski kayıtları doldurur (açılışta, migration'dan sonra). Türkçe karakter kuralı JS'te olduğu için
 * SQL migration'ında yapılamaz. Doldurulacak kayıt yoksa iki hızlı sorgu.
 */
export function backfillKeys(sqlite: Database.Database): void {
  const people = sqlite.prepare(`SELECT id, email, instagram, linkedin FROM people WHERE
    (email IS NOT NULL AND email_key IS NULL) OR (instagram IS NOT NULL AND instagram_key IS NULL) OR (linkedin IS NOT NULL AND linkedin_key IS NULL)`).all() as any[];
  const companies = sqlite.prepare(`SELECT id, name, website, email, instagram, linkedin FROM companies WHERE name_key IS NULL
    OR (website IS NOT NULL AND domain_key IS NULL) OR (email IS NOT NULL AND email_key IS NULL)
    OR (instagram IS NOT NULL AND instagram_key IS NULL) OR (linkedin IS NOT NULL AND linkedin_key IS NULL)`).all() as any[];
  if (!people.length && !companies.length) return;
  const up = sqlite.prepare("UPDATE people SET email_key = @email_key, instagram_key = @instagram_key, linkedin_key = @linkedin_key WHERE id = @id");
  const uc = sqlite.prepare(`UPDATE companies SET name_key = @name_key, domain_key = @domain_key, email_key = @email_key,
    instagram_key = @instagram_key, linkedin_key = @linkedin_key WHERE id = @id`);
  sqlite.transaction(() => {
    for (const p of people) up.run({ id: p.id, ...personKeys(p) });
    for (const c of companies) uc.run({ id: c.id, ...companyKeys(c) });
  })();
}
