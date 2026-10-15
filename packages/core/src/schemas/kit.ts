/** Zod building blocks shared by core's schemas and by the modules' own (`zodKit` in the core exports) */
import { z } from "zod";
import { isIsoDate, isIsoDateTime, resolveRelativeDate } from "../dates";
import { m } from "../messages";

export const id = z.coerce.number().int().positive();
export const text = z.string().trim().min(1);
export const optText = z.string().trim().nullish().transform((v) => (v ? v : null));
export const tl = z.coerce.number().int().min(0);

/** YYYY-MM-DD; "bugün", "yarın", "+3g" gibi kısa biçimler de kabul edilir. Boş değer = temizle. */
export const date = z.preprocess(
  (v) => (v === "" ? null : resolveRelativeDate(v)),
  z.string().refine(isIsoDate, m.schema.dateShape).nullable(),
);
export const dateTime = z.preprocess(
  (v) => resolveRelativeDate(v),
  z.string().refine(isIsoDateTime, m.schema.dateIso),
);

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
