import type { TouchCreated, TouchUpdated } from "../contracts";
import type { Hook } from "../modules/types";
import { upsertInterest } from "./ideas";

/**
 * Listeners for rules that react to a module's event but whose own feature is not a module yet. The registry runs them before the
 * installed modules' hooks of the same event, inside the same transaction; each returns effect strings.
 * TODO(modules): the interest moves to the ideas module (it subscribes itself).
 */
export const coreHooks: Record<string, Hook> = {
  /** A touch about an idea links its person to it */
  "touch.created": (ctx, { touch, subject, input }: TouchCreated) =>
    input.idea_id && subject.person_id ? upsertInterest(ctx.db, ctx, { idea_id: input.idea_id, person_id: subject.person_id, touch_id: touch.id }).effects : [],

  /** A touch edited to be about an idea links its person to the idea */
  "touch.updated": (ctx, { touch, changes }: TouchUpdated) =>
    changes.idea_id ? upsertInterest(ctx.db, ctx, { idea_id: changes.idea_id, person_id: touch.person_id!, touch_id: touch.id }).effects : [],
};
