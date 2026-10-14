import { OPP_STAGES } from "../constants";
import type { TouchCreated, TouchUpdated } from "../contracts";
import type { Hook } from "../modules/types";
import { upsertInterest } from "./ideas";
import { applyStage } from "./opportunities";
import { sendWarnings } from "./quota";
import { requireRow } from "./shared";

/**
 * Listeners for rules that react to a module's event but whose own feature is not a module yet. The registry runs them after the
 * installed modules' hooks of the same event, inside the same transaction; each returns effect strings.
 * TODO(modules): the send warnings move to the drafts module, the interest to ideas, the stage advance to pipeline (each subscribes itself).
 */
export const coreHooks: Record<string, Hook> = {
  /**
   * A touch was written. Send warnings (daily limit, email warmup), then a person touch about an idea links the person to it,
   * then the opportunity stage advances: found + outgoing is contacted, contacted + incoming is replied, a meeting is a meeting;
   * an offer and later stages are left alone.
   */
  "touch.created": (ctx, { touch, subject, input, cold }: TouchCreated) => {
    const effects = sendWarnings(ctx, input, touch.happened_at.slice(0, 10), cold);
    if (input.idea_id && subject.person_id) {
      effects.push(...upsertInterest(ctx.db, ctx, { idea_id: input.idea_id, person_id: subject.person_id, touch_id: touch.id }).effects);
    }
    if (touch.opportunity_id) {
      const o = requireRow(ctx, "opportunities", touch.opportunity_id);
      const next = input.kind === "gorusme" && OPP_STAGES.indexOf(o.stage) < OPP_STAGES.indexOf("gorusme") ? "gorusme"
        : o.stage === "bulundu" && input.direction === "giden" ? "temas" : o.stage === "temas" && input.direction === "gelen" ? "cevap" : null;
      if (next) {
        applyStage(ctx.db, ctx, o, next, { auto: true });
        effects.push(`fırsat #${o.id} → ${next}`);
      }
    }
    return effects;
  },

  /** A touch edited to be about an idea links its person to the idea */
  "touch.updated": (ctx, { touch, changes }: TouchUpdated) =>
    changes.idea_id ? upsertInterest(ctx.db, ctx, { idea_id: changes.idea_id, person_id: touch.person_id!, touch_id: touch.id }).effects : [],
};
