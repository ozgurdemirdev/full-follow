import { z } from "zod";
import { COMMENT_OPTION_CHARS, COMMENT_OPTIONS_MAX, SOURCE_KINDS, TAG_COLORS, FILE_NAME_MAX } from "../constants";
import * as zodKit from "./kit";

const { id, text, optText, tl, date, dateTime, patch } = zodKit;

export const tagCreate = z.strictObject({ name: text, color: z.enum(TAG_COLORS).optional() });
export const tagUpdate = patch({ name: text, color: z.enum(TAG_COLORS) });

export const sourceCreate = z.strictObject({ name: text, kind: z.enum(SOURCE_KINDS).default("diger"), notes: optText });
export const sourceUpdate = patch({ name: text, kind: z.enum(SOURCE_KINDS), notes: optText });

export const fileCreate = z.strictObject({
  /** a record type the installed modules allow files on (`commentTargets` entries with `files`); the file service checks it against the registry */
  target_type: z.string().trim().min(1),
  target_id: id,
  name: text.max(FILE_NAME_MAX),
  mime: text,
  size: id,
  stored_name: text,
});

export const sectorCreate = z.strictObject({ name: text, parent_id: id.nullish() });
export const sectorUpdate = patch({ name: text, parent_id: id.nullable() });

export const noteCreate = z.strictObject({ person_id: id, body: text });
export const noteUpdate = patch({ body: text });

const url = zodKit.webUrl;
/** target_type is checked by the link service against the types modules allow links on (`links` in `commentTargets`) */
export const linkCreate = z.strictObject({ target_type: z.string().trim().min(1), target_id: id, label: text, url });
export const linkUpdate = patch({ label: text, url });

export const commentCreate = z.strictObject({
  /** a record type core or an installed module owns; the comment service checks it against the registry */
  target_type: z.string().trim().min(1).optional(),
  target_id: id.optional(),
  reply_to: id.optional(),
  body: text,
  /** short answers offered with a question; only Claude sets them (checked in the service) */
  options: z.array(text.max(COMMENT_OPTION_CHARS)).min(1).max(COMMENT_OPTIONS_MAX).optional(),
});
export const commentUpdate = patch({ body: text, resolved: z.boolean() });

