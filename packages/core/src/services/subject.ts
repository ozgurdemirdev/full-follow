// Temas ve taslağın muhatabı: kişi, firma ya da sadece adres/hesap (soğuk e-postadaki info@firma.com gibi).
import { FFError, row, rows, type Ctx } from "../context";
import { contactKey } from "../keys";
import { requireRow } from "./shared";

export interface Subject {
  person_id?: number | null;
  company_id?: number | null;
  contact?: string | null;
}
export interface ResolvedSubject {
  person_id: number | null;
  company_id: number | null;
  contact: string | null;
  contact_key: string | null;
}

/**
 * Tek muhatap: kişi > firma > adres. Adres zaten bir kişinin ya da firmanın e-postası/hesabıysa ona bağlanır,
 * yoksa sadece adresle kaydedilir (sonra o adresle kişi/firma açılınca bağlanır).
 */
export function resolveSubject(ctx: Ctx, s: Subject): ResolvedSubject {
  if (s.person_id) return { person_id: requireRow(ctx, "people", s.person_id).id, company_id: null, contact: null, contact_key: null };
  if (s.company_id) return { person_id: null, company_id: requireRow(ctx, "companies", s.company_id).id, contact: null, contact_key: null };
  const contact = s.contact?.trim();
  if (!contact) throw new FFError("validation", "kişi, firma ya da adres (contact) gerekli");
  const key = contactKey(contact)!;
  const [kind, value] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "email" || kind === "instagram" || kind === "linkedin") {
    const p = row<{ id: number }>(ctx, `SELECT id FROM people WHERE ${kind}_key = ? LIMIT 1`, value);
    if (p) return { person_id: p.id, company_id: null, contact: null, contact_key: null };
    const c = row<{ id: number }>(ctx, `SELECT id FROM companies WHERE ${kind}_key = ? LIMIT 1`, value);
    if (c) return { person_id: null, company_id: c.id, contact: null, contact_key: null };
  }
  return { person_id: null, company_id: null, contact, contact_key: key };
}

/** Şablon yer tutucuları ve listeler için muhatap bilgisi */
export function subjectInfo(ctx: Ctx, s: Subject) {
  if (s.person_id) {
    const p = row(ctx, "SELECT p.name, p.company_id, c.name AS company FROM people p LEFT JOIN companies c ON c.id = p.company_id WHERE p.id = ?", s.person_id);
    if (!p) return null;
    // kişinin sektörü yoksa firmanınki
    const sectors = sectorList(ctx, "person", s.person_id);
    return { name: p.name as string, first: firstName(p.name), company: (p.company as string | null) ?? "", sectors: sectors.length || !p.company_id ? sectors : sectorList(ctx, "company", p.company_id) };
  }
  if (s.company_id) {
    const c = row(ctx, "SELECT name FROM companies WHERE id = ?", s.company_id);
    if (!c) return null;
    return { name: c.name as string, first: c.name as string, company: c.name as string, sectors: sectorList(ctx, "company", s.company_id) };
  }
  if (s.contact) return { name: s.contact, first: "", company: "", sectors: [] as SectorRef[] };
  return null;
}

export interface SectorRef {
  id: number;
  parent_id: number | null;
  name: string;
}

function sectorList(ctx: Ctx, owner: "person" | "company", id: number): SectorRef[] {
  const t = owner === "person" ? "person_sectors" : "company_sectors";
  const col = owner === "person" ? "person_id" : "company_id";
  return rows<SectorRef>(ctx, `SELECT s.id, s.parent_id, s.name FROM ${t} x JOIN sectors s ON s.id = x.sector_id WHERE x.${col} = ? ORDER BY s.name`, id);
}

const firstName = (name: string) => String(name).replace(/^(dr|av|prof)\.?\s+/i, "").trim().split(/\s+/)[0] ?? name;

/** Muhatap SQL koşulu (aynı kişiye/firmaya/adrese ait temaslar) */
export function subjectWhere(s: ResolvedSubject | Subject, alias = ""): [string, unknown[]] {
  const a = alias ? `${alias}.` : "";
  if (s.person_id) return [`${a}person_id = ?`, [s.person_id]];
  if (s.company_id) return [`${a}company_id = ? AND ${a}person_id IS NULL`, [s.company_id]];
  return [`${a}person_id IS NULL AND ${a}company_id IS NULL AND ${a}contact = ?`, [s.contact]];
}
