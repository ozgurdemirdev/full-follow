import { z } from "zod";
import { CONTACT_STATUSES, zodKit } from "@fullfollow/core";

const { id, text, optText, patch, tagLabels } = zodKit;

const companyShape = {
  name: text,
  website: optText,
  email: optText,
  phone: optText,
  instagram: optText,
  linkedin: optText,
  source_id: id.nullable(),
  contact_status: z.enum(CONTACT_STATUSES),
  notes: optText,
  city: optText,
};
export const companyCreate = z.strictObject({
  ...companyShape,
  source_id: companyShape.source_id.optional(),
  contact_status: companyShape.contact_status.optional(),
  ...tagLabels,
});
export const companyUpdate = patch(companyShape).extend(tagLabels);
