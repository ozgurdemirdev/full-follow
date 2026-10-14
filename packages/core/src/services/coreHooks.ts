import type { RecordTrashed, TouchCreated, TouchUpdated } from "../contracts";
import type { Hook } from "../modules/types";
import { upsertInterest } from "./ideas";
import { sendWarnings } from "./quota";

/**
 * Listeners for rules that react to a module's event but whose own feature is not a module yet. The registry runs them after the
 * installed modules' hooks of the same event, inside the same transaction; each returns effect strings.
 * TODO(modules): the send warnings move to the drafts module, the interest to ideas, the drafts' links to opportunities and projects to drafts (each subscribes itself).
 */
export const coreHooks: Record<string, Hook> = {
  /** A touch was written. Send warnings (daily limit, email warmup), then a person touch about an idea links the person to it. (The pipeline module advances the opportunity stage.) */
  "touch.created": (ctx, { touch, subject, input, cold }: TouchCreated) => {
    const effects = sendWarnings(ctx, input, touch.happened_at.slice(0, 10), cold);
    if (input.idea_id && subject.person_id) {
      effects.push(...upsertInterest(ctx.db, ctx, { idea_id: input.idea_id, person_id: subject.person_id, touch_id: touch.id }).effects);
    }
    return effects;
  },

  /** An opportunity or project that goes to the trash: the drafts about it are kept, only their link is emptied (restoring ties them back) */
  "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
    if (type === "opportunity") bin.unlink("drafts", "opportunity_id", id);
    else if (type === "project") bin.unlink("drafts", "project_id", id);
  },

  /** A touch edited to be about an idea links its person to the idea */
  "touch.updated": (ctx, { touch, changes }: TouchUpdated) =>
    changes.idea_id ? upsertInterest(ctx.db, ctx, { idea_id: changes.idea_id, person_id: touch.person_id!, touch_id: touch.id }).effects : [],
};
