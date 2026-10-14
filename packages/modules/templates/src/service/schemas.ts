import { z } from "zod";
import { CHANNELS, TEMPLATE_KINDS, zodKit } from "@fullfollow/core";

const { id, text, patch } = zodKit;

export const templateCreate = z.strictObject({
  name: text,
  kind: z.enum(TEMPLATE_KINDS).default("ilk"),
  channel: z.enum(CHANNELS).nullish(),
  sector_id: id.nullish(),
  body: text,
});
export const templateUpdate = patch({
  name: text,
  kind: z.enum(TEMPLATE_KINDS),
  channel: z.enum(CHANNELS).nullable(),
  sector_id: id.nullable(),
  body: text,
});
