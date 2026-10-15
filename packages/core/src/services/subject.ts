// Temas ve taslağın muhatabı: kişi, firma ya da sadece adres/hesap (soğuk e-postadaki info@firma.com gibi).
// Shared by the network, drafts and templates modules, so it stays in core.
import { FFError, row, rows, type Ctx } from "../context";
import { localDay } from "../dates";
import { contactKey } from "../keys";
import { m } from "../messages";
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
  if (!contact) throw new FFError("validation", m.schema.subjectNeeded);
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

/** The record's own person, a colleague at the same company, or that company itself (e.g. a reply sent "as Pizza Z") */
export function sameSide(ctx: Ctx, ownerId: number, s: { person_id?: number | null; company_id?: number | null }) {
  if (s.person_id === ownerId) return true;
  const own = rows<{ company_id: number | null }>(ctx, "SELECT company_id FROM people WHERE id = ?", ownerId)[0]?.company_id;
  if (!own) return false;
  if (s.person_id) return rows(ctx, "SELECT 1 FROM people WHERE id = ? AND company_id = ?", s.person_id, own).length > 0;
  return s.company_id === own;
}

/** SQL for the touches of a company: written to the company itself or to one of its people (touch alias `t`, the company id twice) */
export const COMPANY_TOUCHES = "(t.company_id = ? OR t.person_id IN (SELECT id FROM people WHERE company_id = ?))";

/** SQL for the touches of a person (`p` is the people row) and of an opportunity (its row has the given alias): its own touches and any touch to its person */
export const PERSON_TOUCHES = "t.person_id = p.id";
export const opportunityTouches = (alias: string) => `(t.opportunity_id = ${alias}.id OR t.person_id = ${alias}.person_id)`;

/**
 * SQL for "the follow-up of a record is done": an outgoing touch to it happened on or after the follow-up date (`dateColumn`, a date).
 * `touchesOf` picks the touches that belong to the record (touch alias `t`). The calendar feed, Today and the lists all take `done` from here.
 * The first condition is a range on `happened_at` (the day before is enough for any time zone offset): it lets the check start from the recent touches
 * instead of every touch of the record or, for an opportunity, every touch there is. The local day is the exact test.
 * It reads the touches table directly on purpose: the table always exists, so it keeps working without the network module.
 */
export const followUpDone = (touchesOf: string, dateColumn: string) =>
  `EXISTS (SELECT 1 FROM touches t WHERE t.happened_at >= date(substr(${dateColumn}, 1, 10), '-1 day') AND ${touchesOf} AND t.direction = 'giden' AND ${localDay("t.happened_at")} >= substr(${dateColumn}, 1, 10))`;

/**
 * Şablondaki yer tutucular: {ad} {ad_soyad} {firma} {sektor}. Bilinmeyen yer tutucu olduğu gibi kalır.
 * Firmaya giden mesajda {ad} ve {firma} firma adıdır; sadece adrese giden mesajda {ad} boş kalır.
 */
export function renderTemplate(ctx: Ctx, body: string, subject: Subject): string {
  const p = subjectInfo(ctx, subject);
  if (!p) return body;
  const sector = p.sectors[0]?.name ?? "";
  const vals: Record<string, string> = { ad: p.first, ad_soyad: p.name, firma: p.company, sektor: sector, sektör: sector };
  return body.replace(/\{(\w+|sektör)\}/g, (m, k: string) => (k in vals ? vals[k] : m)).replace(/[ \t]{2,}/g, " ").replace(/ ,/g, ",");
}

/** SQL: touch `x` (a sent message) got a later incoming touch from the same person, company or bare contact */
export const REPLIED_AFTER = `EXISTS (
  SELECT 1 FROM touches g WHERE g.direction = 'gelen' AND g.happened_at > x.happened_at AND (g.person_id = x.person_id
    OR (x.person_id IS NULL AND g.company_id = x.company_id) OR (x.person_id IS NULL AND x.company_id IS NULL AND g.contact_key = x.contact_key)))`;

/** Cold email: an outgoing email message to a recipient (person, company or bare address) with no earlier touch at all. Call before inserting the touch. */
export function isColdEmail(ctx: Ctx, t: { channel: string; direction: string; kind: string }, s: ResolvedSubject): boolean {
  if (t.channel !== "email" || t.direction !== "giden" || t.kind !== "mesaj") return false;
  const [column, value] = s.person_id ? ["person_id", s.person_id] : s.company_id ? ["company_id", s.company_id] : ["contact_key", s.contact_key];
  return !row(ctx, `SELECT 1 FROM touches WHERE ${column} = ? LIMIT 1`, value);
}
