import type { OppRole, OppStage } from "../constants";
import type { ListOpts } from "../context";

/** An opportunity row as stored */
export interface OpportunityRecord {
  id: number;
  title: string;
  person_id: number;
  source_id: number;
  stage: OppStage;
  estimated_value: number | null;
  lost_reason: string | null;
  next_follow_up_at: string | null;
  closed_at: string | null;
  /** order inside its stage column of the board */
  position: number;
  /** when it entered its current stage (ISO; set on create and on every stage change) */
  stage_since: string | null;
  /** link and date of the listing or topic the opportunity came from */
  source_url: string | null;
  source_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** An opportunity as listed: the row plus the names it hangs on and the project it became (null when the projects module is missing) */
export interface OpportunityRow extends OpportunityRecord {
  person_name: string;
  company_id: number | null;
  company_name: string | null;
  source_name: string;
  project_id: number | null;
}

/** Per open stage: the chance an opportunity there is won (0 to 1, for the weighted forecast) and the days after which it counts as stale */
export interface StageRule {
  stage: OppStage;
  probability: number;
  stale_days: number;
}

/** Of the opportunities that left a stage in the last days, the share that moved forward (null while none left) */
export interface StageRate {
  stage: OppStage;
  to_next: number | null;
}

/** What `GET /api/opportunities` adds to the list: the stage rules and the stage to stage rates */
export interface PipelineMeta {
  stages: StageRule[];
  stage_rates: StageRate[];
}

/** What other modules need to know about an opportunity without loading the list */
export interface OpportunityRef {
  id: number;
  title: string;
  person_id: number;
}

export interface OfferItem {
  label: string;
  amount: number;
}

/** An offer version as stored (items parsed) */
export interface OfferRecord {
  id: number;
  opportunity_id: number;
  version: number;
  offered_at: string;
  amount: number;
  items: OfferItem[];
  note: string | null;
  /** ISO date, null while the offer is not the accepted one */
  accepted_at: string | null;
  file_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** An extra person on an opportunity (the main contact is the opportunity's own person_id) */
export interface TeamMemberRow {
  id: number;
  opportunity_id: number;
  person_id: number;
  role: OppRole;
  note: string | null;
  person_name: string;
  company_name: string | null;
}

/** One step of the lead source funnel: how many records reached it and the rate against the previous step */
export interface FunnelStepCount {
  key: string;
  count: number;
  rate: number | null;
}

export interface SourceFunnel {
  period: number | "all";
  since: string | null;
  sources: {
    source_id: number;
    source: string;
    steps: FunnelStepCount[];
    reply_rate: number | null;
    early: boolean;
    weak: boolean;
  }[];
}

/** Won, lost and open opportunities of one lead source (the conversion report) */
export interface SourceConversion {
  source_id: number;
  source: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  won_value: number;
  conversion: number | null;
}

/** What one person's opportunities add up to */
export interface PersonPipelineStats {
  opps: number;
  won: number;
  won_value: number;
  open_value: number;
}

/** An open opportunity's follow-up date, as the calendar feed lists it */
export interface OpportunityFollowUp {
  type: "opportunity";
  id: number;
  name: string;
  /** an outgoing touch on or after the follow-up date */
  done: boolean;
  date: string;
}

/**
 * Emitted by the pipeline module inside the move transaction when an opportunity becomes won (from any other stage).
 * Everything a listener needs travels in the payload as plain data, so a listener never reads the pipeline tables.
 * The projects module opens the project with its payment plan from it; the hooks' effect strings join the move's effects.
 */
export interface OpportunityWon {
  opportunity: { id: number; title: string; person_id: number; company_id: number | null; estimated_value: number | null };
  /** the accepted offer, null when none is accepted */
  offer: { id: number; amount: number; items: OfferItem[] } | null;
  /** the project price: the accepted offer's amount, else the opportunity's estimate, else 0 */
  price: number;
}

/**
 * Public API of the pipeline module (`ctx.mod("pipeline")`): opportunities and their stage moves, the extra people on them (team),
 * offers and the lead source funnel. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface PipelineApi {
  opportunities: {
    create(input: unknown): { row: OpportunityRecord; effects: string[] };
    /** fields, and team changes (`add_people`, `remove_people`); the stage changes through `move` */
    update(id: number, input: unknown): { row: OpportunityRecord; effects: string[] };
    /** `{ stage, reason?, position? }`; lost needs a reason; won emits `opportunity.won` and tags the person as a customer */
    move(id: number, input: unknown): { row: OpportunityRecord; effects: string[] };
    /** into the trash with its offers, team, files, comments and links; an opportunity that has a project stays */
    remove(id: number): { effects: string[]; trash: { type: string; id: number } };
    /** filters: stage, person_id, source_id, company_id, open, due, board */
    list(opts: ListOpts): { rows: OpportunityRow[]; total: number };
    get(id: number): OpportunityRow | undefined;
    /** a light lookup (one row) */
    ref(id: number): OpportunityRef | undefined;
    /** titles of these opportunities (one statement; lists of other modules show them) */
    titles(ids: number[]): Map<number, string>;
    /** ids of the person's open opportunities */
    openIdsOf(personId: number): number[];
    /** how many opportunities the person has */
    countOf(personId: number): number;
  };
  offers: {
    create(input: unknown): { row: OfferRecord; effects: string[] };
    /** `{ accepted: true }` accepts (the others are cleared, the opportunity's value follows the amount), `{ accepted: false }` takes it back */
    update(id: number, input: unknown): { row: OfferRecord; effects: string[] };
    remove(id: number): { effects: string[]; trash: { type: string; id: number } };
    /** filter: opportunity_id; newest version first inside an opportunity */
    list(opts: ListOpts): { rows: (OfferRecord & { opportunity_title: string })[]; total: number };
    get(id: number): (OfferRecord & { opportunity_title: string }) | undefined;
    /** offer versions of one opportunity, newest first */
    of(opportunityId: number): OfferRecord[];
  };
  team: {
    /** adds a member or changes the role and note of one already on the team */
    add(opportunityId: number, input: unknown): { row: unknown; effects: string[] };
    update(id: number, input: unknown): { row: unknown; effects: string[] };
    remove(id: number): { effects: string[]; trash: { type: string; id: number } };
    of(opportunityId: number): TeamMemberRow[];
  };
  /** per lead source: people and companies found there and how far they got (period: 30 | 90 | all) */
  funnel(period?: unknown): SourceFunnel;
  /** won / lost / open per lead source */
  bySource(): SourceConversion[];
  /** opportunity count per lead source */
  countsBySource(): Map<number, number>;
  /** open opportunities per company (through the company's people): how many and their estimated value */
  openByCompany(): Map<number, { count: number; value: number }>;
  /** the stage rules and the stage to stage rates of the last 90 days, from the stage change events (one grouped query) */
  meta(): PipelineMeta;
  /** per person: opportunities, won ones and their value */
  personStats(): Map<number, PersonPipelineStats>;
  /** follow-up dates of open opportunities in the range */
  followUpsDue(from: string, to: string): OpportunityFollowUp[];
  /** opportunities that moved to the offer stage in the range (counted from the stage events) */
  offersMade(from: string, to: string): number;
  /** opportunities lost in a month (YYYY-MM, by the day they were closed): how many and the sum of their estimated values */
  lostIn(ym: string): { count: number; budget: number };
  /** when opportunities in the offer stage were last touched (open offers; the silent ones are old) */
  openOfferTimes(): string[];
  /** creation times of offers made since the date */
  offerCreatedSince(since: string): string[];
}
