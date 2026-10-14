import type { FeedKind, TimelineEventDef } from "@fullfollow/core";

/** The kinds of the feed, in the order of the type pills of the timeline screen */
export const FEED_KINDS: readonly FeedKind[] = ["temas", "odeme", "gorev", "asama", "taslak", "yorum"];

/** Rows of a feed page when the request does not say, and the most a request may ask for (a larger limit is cut to this) */
export const FEED_DEFAULT_LIMIT = 60;
export const FEED_MAX_LIMIT = 200;
/** The longest search text of the feed */
export const FEED_QUERY_MAX = 100;

/** Events of one record's own timeline: the MCP default and the REST default */
export const RECORD_TIMELINE_LIMIT = 20;
export const RECORD_TIMELINE_HTTP_LIMIT = 50;

/** Days of the week strip */
export const WEEK_DAYS = 7;
/** Draft statuses that count as approved in the week strip ("Claude taslağı: N onaylandı") */
export const DRAFT_APPROVED_STATUSES = ["onaylandi", "gonderildi"];

/** Events core itself writes that show in the feed (the other modules list theirs with the `timelineKinds` contribution) */
export const CORE_EVENT_KINDS: Record<string, TimelineEventDef> = {
  "comment.created": { kind: "yorum" },
};
