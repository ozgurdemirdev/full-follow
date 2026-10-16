/** Zod building blocks shared by core's schemas and by the modules' own (`zodKit` in the core exports) */
import { z } from "zod";
import { isIsoDate, isIsoDateTime, resolveRelativeDate } from "../dates";
import { m } from "../messages";

export const id = z.coerce.number().int().positive();
export const text = z.string().trim().min(1);
export const optText = z.string().trim().nullish().transform((v) => (v ? v : null));
export const tl = z.coerce.number().int().min(0);

/**
 * A web address as stored: http or https only, without user or password; a bare domain ("firma.com", "firma.com/ilan") gets
 * https://. Every other scheme (javascript:, data:, file:, ...) is refused, because the panel turns these fields into links.
 */
export function toWebUrl(raw: string): string | null {
  const parse = (s: string) => {
    try {
      return new URL(s);
    } catch {
      return null;
    }
  };
  const direct = parse(raw);
  const u = direct && (direct.protocol === "http:" || direct.protocol === "https:") ? direct : raw.includes("://") ? null : parse(`https://${raw}`);
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password || !u.hostname) return null;
  return u === direct ? raw : `https://${raw}`;
}

const webUrlOf = (v: string, ctx: z.RefinementCtx) => {
  const url = toWebUrl(v);
  if (url === null) ctx.addIssue({ code: "custom", message: m.schema.webUrl });
  return url ?? v;
};
export const webUrl = z.string().trim().min(1).transform(webUrlOf);
export const optWebUrl = z.string().trim().nullish().transform((v, ctx) => (v ? webUrlOf(v, ctx) : null));

/** YYYY-MM-DD; "bugün", "yarın", "+3g" gibi kısa biçimler de kabul edilir. Boş değer = temizle. */
export const date = z.preprocess(
  (v) => (v === "" ? null : resolveRelativeDate(v)),
  z.string().refine(isIsoDate, m.schema.dateShape).nullable(),
).describe("YYYY-MM-DD; also bugün, yarın or +3g (days from today); empty clears it");
export const dateTime = z.preprocess(
  (v) => resolveRelativeDate(v),
  z.string().refine(isIsoDateTime, m.schema.dateIso),
).describe("ISO date time (2026-10-14T09:30:00) or a short form like bugün");

/** create şemasını güncellemeye çevirir: alanlar opsiyonel */
export const patch = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape).partial();

/** Etiket ya da sektör: id, ad ("Sıcak") ya da sektör yolu ("Sağlık > Diş hekimi") */
export const refList = z.array(z.union([z.number().int().positive(), z.string().trim().min(1)]));
/** Kişi ve firmada ortak: etiketler (tags tümünü değiştirir, add_tags/remove_tags ekler/çıkarır) ve sektörler */
export const tagLabels = {
  tags: refList.optional(),
  add_tags: refList.optional(),
  remove_tags: refList.optional(),
  sectors: refList.optional(),
};

/**
 * Temas ve taslağın muhatabı: kişi, firma ya da sadece adres/hesap (info@firma.com, @hesap).
 * Biri yeterli; kişi verilirse firma ve adres yok sayılır, firma verilirse adres yok sayılır.
 */
export const subjectShape = {
  person_id: id.nullish(),
  company_id: id.nullish(),
  contact: optText,
};
export const needSubject = (d: { person_id?: number | null; company_id?: number | null; contact?: string | null }) => !!(d.person_id || d.company_id || d.contact);
export const subjectMsg = { message: m.schema.subjectNeeded, path: ["person_id"] };
