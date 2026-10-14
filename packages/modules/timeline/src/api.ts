import type { Ctx, TimelineApi, TimelineEventDef } from "@fullfollow/core";
import { CORE_EVENT_KINDS, RECORD_TIMELINE_LIMIT } from "./constants";
import { feedOf } from "./service/feed";
import { timelineOf } from "./service/record";
import { weekOf } from "./service/week";

/** The timeline module's implementation of its contract (`TimelineApi` in core's contracts) */
export function timelineApi(ctx: Ctx): TimelineApi {
  // which events show in the feed: core's own and what the installed modules list (the set never changes for this context)
  const kinds: Record<string, TimelineEventDef> = Object.assign({}, CORE_EVENT_KINDS, ...ctx.contrib("timelineKinds"));
  return {
    forRecord: (type, id, limit = RECORD_TIMELINE_LIMIT) => timelineOf(ctx, type, id, limit),
    feed: (query) => feedOf(ctx, kinds, query),
    week: (start) => weekOf(ctx, kinds, start),
  };
}
