import { z } from "zod";
import { CONTACT_STATUSES, zodKit } from "@fullfollow/core";

const { id, text, optText, date, patch, tagLabels } = zodKit;

const personShape = {
  name: text,
  company_id: id.nullable(),
  role: optText,
  email: optText,
  phone: optText,
  instagram: optText,
  linkedin: optText,
  handle: optText,
  referred_by_id: id.nullable(),
  post_id: id.nullable(),
  source_id: id.nullable(),
  contact_status: z.enum(CONTACT_STATUSES),
  next_follow_up_at: date,
  notes: optText,
};
export const personCreate = z.strictObject({
  ...personShape,
  company_id: personShape.company_id.optional(),
  referred_by_id: personShape.referred_by_id.optional(),
  post_id: personShape.post_id.optional(),
  source_id: personShape.source_id.optional(),
  contact_status: personShape.contact_status.optional(),
  next_follow_up_at: personShape.next_follow_up_at.optional(),
  ...tagLabels,
});
export const personUpdate = patch(personShape).extend(tagLabels);
