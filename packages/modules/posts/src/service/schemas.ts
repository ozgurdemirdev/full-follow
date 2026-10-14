import { z } from "zod";
import { zodKit } from "@fullfollow/core";
import { POST_FORMATS, POST_PLATFORMS } from "./constants";

const { id, text, optText, date, patch } = zodKit;

const days = z.coerce.number().int().min(1).max(365);

export const postCreate = z.strictObject({
  platform: z.enum(POST_PLATFORMS),
  title: text,
  url: optText,
  body: optText,
  posted_at: date.optional(),
  refresh_days: days.nullish(),
  format: z.enum(POST_FORMATS).nullish(),
  idea_id: id.nullish(),
  notes: optText,
});
export const postUpdate = patch({
  platform: z.enum(POST_PLATFORMS),
  title: text,
  url: optText,
  body: optText,
  posted_at: date,
  refresh_days: days.nullable(),
  format: z.enum(POST_FORMATS).nullable(),
  idea_id: id.nullable(),
  notes: optText,
  /** true: "güncelledim" (yenileme tarihi bugün olur) */
  refreshed: z.boolean(),
});
