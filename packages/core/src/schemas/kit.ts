/** Zod building blocks shared by core's schemas and by the modules' own (`zodKit` in the core exports) */
import { z } from "zod";
import { isIsoDate, isIsoDateTime, resolveRelativeDate } from "../dates";

export const id = z.coerce.number().int().positive();
export const text = z.string().trim().min(1);
export const optText = z.string().trim().nullish().transform((v) => (v ? v : null));
export const tl = z.coerce.number().int().min(0);

/** YYYY-MM-DD; "bugün", "yarın", "+3g" gibi kısa biçimler de kabul edilir. Boş değer = temizle. */
export const date = z.preprocess(
  (v) => (v === "" ? null : resolveRelativeDate(v)),
  z.string().refine(isIsoDate, "tarih YYYY-MM-DD olmalı").nullable(),
);
export const dateTime = z.preprocess(
  (v) => resolveRelativeDate(v),
  z.string().refine(isIsoDateTime, "tarih ISO olmalı"),
);

/** create şemasını güncellemeye çevirir: alanlar opsiyonel */
export const patch = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape).partial();
