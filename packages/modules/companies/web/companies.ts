// Companies screen: segments, money, sort and the ask for a draft.
// The server sends the page of companies (filtered, sorted, with the people of each tile) and the numbers of the whole book; nothing is joined here.
import type { Company, CompanyOverviewRow } from "@kit/api/types";
import type { ClaudeRequest } from "@kit/lib/askClaude";
import { fmtMonth } from "@kit/lib/format";
import { daysSince } from "@kit/lib/people";
import { m as kit } from "@kit/messages";
import { m } from "./messages";

/** Tiles one page of the list asks for; the next page comes as the end of the list scrolls into view */
export const TILE_PAGE = 48;
/** People avatars drawn on a tile */
export const TILE_AVATARS = 4;

export type Segment = Company["segment"];
export type SegmentFilter = "all" | Segment;
export const SEGMENT_LABEL: Record<Segment, string> = m.segment;
export const SEGMENT_FILTERS: { key: SegmentFilter; label: string }[] = [
  { key: "all", label: kit.all },
  { key: "client", label: SEGMENT_LABEL.client },
  { key: "lead", label: SEGMENT_LABEL.lead },
  { key: "partner", label: SEGMENT_LABEL.partner },
];

export type SortKey = "value" | "recent" | "name";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "value", label: m.sorts.value },
  { key: "recent", label: m.sorts.recent },
  { key: "name", label: kit.fields.name },
];


/** Paid on the projects of the company, the unpaid part of their payments, the estimated value of its open opportunities */
export type Money = Company["money"];

/** A company as the screen shows it: the row the server sent with the numbers worked out for the tile */
export interface CompanyView {
  c: Company;
  segment: Segment;
  money: Money;
  total: number;
  /** the people on the tile: the most recently touched few (`c.people_count` is how many there are) */
  people: CompanyOverviewRow["people"];
  /** latest open comment of Claude on the company */
  hint: string | null;
  /** days since the last touch, null when there is none */
  days: number | null;
  /** first project start (else null) as a month label */
  since: string | null;
}

export function viewOf(r: CompanyOverviewRow): CompanyView {
  const { people, hint, first_project_at, ...c } = r;
  return {
    c,
    segment: c.segment,
    money: c.money,
    total: c.money.won + c.money.due + c.money.open,
    people,
    hint,
    days: c.last_touch_at ? daysSince(c.last_touch_at) : null,
    since: first_project_at ? fmtMonth(first_project_at.slice(0, 7)) : null,
  };
}

/** Website as shown: without scheme and trailing slash */
export const siteLabel = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

// ------------------------------------------------------------ overlay
/** The request for Claude to write a message draft to the right person of the company */
export const companyDraftRequest = (c: Pick<Company, "id" | "name">): ClaudeRequest => ({ title: m.draftTask(c.name), target: { company_id: c.id }, ok: m.draftAsked, draft: true });
