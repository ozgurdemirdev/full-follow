import type { ContactStatus } from "../constants";
import type { ListOpts } from "../context";
import type { ChannelSummary } from "./network";

/** A company row as stored (the duplicate keys are left out; they never leave the module) */
export interface CompanyRecord {
  id: number;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  /** where the company was found (the lead source list) */
  source_id: number | null;
  contact_status: ContactStatus;
  notes: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** What a company is to Özgür: a client (has a project), a partner (carries a partner tag) or a lead (everything else) */
export type CompanySegment = "client" | "partner" | "lead";

/** Money of a company in TL: paid on its projects, still due on them, and the value of its open opportunities */
export interface CompanyMoney {
  won: number;
  due: number;
  open: number;
}

/** A company as listed: the row plus its labels, people, last touch, open opportunities, segment and money (zeros without the projects and pipeline modules) */
export interface CompanyRow extends CompanyRecord {
  source_name: string | null;
  tags: string[];
  tag_ids: number[];
  sectors: { id: number; parent_id: number | null; path: string }[];
  sector_path: string | null;
  people_count: number;
  /** last touch of the company or one of its people */
  last_touch_at: string | null;
  touch_count: number;
  open_opps: number;
  segment: CompanySegment;
  money: CompanyMoney;
}

/** Everything the company page shows, in one object (the touch parts are empty without the network module) */
export interface CompanyCard {
  row: CompanyRow;
  people: any[];
  touches: { rows: any[]; total: number };
  opportunities: any[];
  drafts: any[];
  channels: ChannelSummary[];
  source: { id: number; name: string } | null;
  threads: any[];
}

/**
 * Public API of the companies module (`ctx.mod("companies")`): companies, their tags and sectors, contact status and the company card.
 * The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface CompaniesApi {
  create(input: unknown): { row: CompanyRecord; effects: string[] };
  update(id: number, input: unknown): { row: CompanyRecord; effects: string[] };
  /** the company goes to the trash with its own touches, drafts and comments; its people stay and lose the link (it comes back on restore) */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** filters: ids (only these companies), tag, sector, source, status */
  list(opts: ListOpts): { rows: CompanyRow[]; total: number };
  get(id: number): CompanyRow | undefined;
  /** names of these companies (one statement; lists of other modules show them) */
  names(ids: number[]): Map<number, string>;
  card(id: number): CompanyCard;
  /** moves the company's contact status forward, never back; returns what changed */
  bumpStatus(id: number, next: ContactStatus): string[];
}
