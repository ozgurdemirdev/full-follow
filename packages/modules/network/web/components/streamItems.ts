import type { Comment, Note, PersonCard, Thread, Touch } from "@kit/api/types";
import { m } from "../messages";

export type StreamKind = "in" | "out" | "note" | "claude";
export type StreamFilter = "all" | "touch" | "note" | "claude";
export const STREAM_FILTERS: { key: StreamFilter; label: string }[] = [
  { key: "all", label: m.streamFilters.all },
  { key: "touch", label: m.streamFilters.touch },
  { key: "note", label: m.streamFilters.note },
  { key: "claude", label: m.streamFilters.claude },
];

export interface StreamItem {
  key: string;
  kind: StreamKind;
  /** ISO time the entry sorts by */
  at: string;
  touch?: Touch;
  note?: Note;
  comment?: Comment;
  /** thread of a comment entry */
  thread?: Thread;
}

/** Touches, notes and comments (both sides of the Claude threads) of one person, newest first */
export function buildStream(card: PersonCard): StreamItem[] {
  const items: StreamItem[] = [
    ...card.touches.rows.map((t): StreamItem => ({ key: `t${t.id}`, kind: t.direction === "gelen" ? "in" : "out", at: t.happened_at, touch: t })),
    ...card.notes.map((n): StreamItem => ({ key: `n${n.id}`, kind: "note", at: n.created_at, note: n })),
    ...card.threads.flatMap((th) => (th.comments ?? []).map((c): StreamItem => ({ key: `c${c.id}`, kind: "claude", at: c.created_at, comment: c, thread: th }))),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export const matchesFilter = (i: StreamItem, f: StreamFilter) =>
  f === "all" || (f === "touch" ? i.kind === "in" || i.kind === "out" : i.kind === f);
