import type { Actor } from "../lib/labels";

/** Event kinds of the timeline board, in the order of its type pills */
export type TlType = "temas" | "odeme" | "gorev" | "asama" | "taslak" | "yorum";

/** The record an event belongs to (the chip of a row, the target of the focus card) */
export interface TlRec {
  /** "kind:id", the focus and filter key */
  key: string;
  /** record type as recordPath knows it: person, company, opportunity, project, own_project, idea, post, template */
  kind: string;
  id: number;
  name: string;
}

/** One row of the global feed, built in the browser from the lists the screens already load.
 *  Gap: becomes a row of a core `GET /timeline` feed (same fields) when the timeline module lands. */
export interface TlItem {
  key: string;
  /** epoch ms the feed sorts by */
  at: number;
  /** false when the source only knows the day (a payment date): the row shows no clock */
  timed: boolean;
  type: TlType;
  by: Actor;
  text: string;
  /** TL, payments only */
  amount?: number;
  rec: TlRec | null;
  /** every record the event touches (person, opportunity, project...): focusing any of them shows the row */
  refs: string[];
  /** drafts only: Özgür approved or sent it */
  approved?: boolean;
}

export interface TlWeekTile {
  type: TlType;
  label: string;
  value: string;
  sub: string;
}
export interface TlWeek {
  me: number;
  cl: number;
  tiles: TlWeekTile[];
}
