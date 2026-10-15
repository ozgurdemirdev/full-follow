// Referrals screen: the tree and its layout (derived in the web) and the shapes of the suggestion lists the API sends
import type { Person, ReferralKpis, ReferralValue } from "@kit/api/types";

export type { ReferralKpis };

/** Opportunity value a person brought as the contact of the opportunity */
export interface RefOwn {
  won: number;
  open: number;
}
/** Value of everything below a person in the tree */
export interface RefNet extends RefOwn {
  people: number;
  wonCount: number;
}
export interface RefNode {
  person: Pick<Person, "id" | "name" | "company_name">;
  own: RefOwn;
  /** descendants only, not the person */
  net: RefNet;
  kids: RefNode[];
}
export interface RefPlaced {
  node: RefNode;
  level: number;
  /** top of the row in px */
  y: number;
  /** x in percent of the tree width */
  x: number;
}
export type RefTone = "won" | "open" | "none";
export interface RefEdge {
  key: number;
  d: string;
  tone: RefTone;
  /** dash length that covers the whole edge, px */
  len: number;
}
export interface RefLayout {
  nodes: RefPlaced[];
  edges: RefEdge[];
  /** node width in percent of the tree width */
  width: number;
  /** tree height in px */
  height: number;
  depth: number;
}
export interface RefKpi {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}
/** One row of "Teşekkür zamanı" or "Kimden referans istenir" */
export interface RefSuggestion {
  person: Pick<Person, "id" | "name">;
  why: string;
  /** false: shown dimmed without a button (a payment is late) */
  ready: boolean;
  /** "asked": a request for Claude is open; "drafted": a draft is waiting in Taslaklar */
  state: "idle" | "asked" | "drafted";
  /** the title of the task that asks Claude for the draft */
  request_title: string;
}
/** `GET /report/referrals`: the leaders, the numbers on top and the two suggestion lists */
export interface ReferralReport {
  leaders: ReferralValue[];
  kpis: ReferralKpis;
  thanks: RefSuggestion[];
  asks: RefSuggestion[];
}
