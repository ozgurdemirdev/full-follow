import type { OwnProjectStatus, Sellable } from "../constants";
import type { ListOpts } from "../context";

/** An own project row as stored: a product Özgür builds for himself, not client work */
export interface OwnProjectRecord {
  id: number;
  name: string;
  description: string | null;
  status: OwnProjectStatus;
  sellable: Sellable;
  /** who could buy it and how */
  sellable_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** An own project as listed: the row plus its open and done idea counts and sectors */
export interface OwnProjectStats extends OwnProjectRecord {
  open_ideas: number;
  done_ideas: number;
  sectors: { id: number; path: string }[];
}

/**
 * Public API of the own-projects module (`ctx.mod("own-projects")`): Özgür's own products, their status, sellability and sectors.
 * Their ideas belong to the ideas module. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface OwnProjectsApi {
  create(input: unknown): { row: OwnProjectRecord; effects: string[] };
  update(id: number, input: unknown): { row: OwnProjectRecord; effects: string[] };
  /** a status change (aktif, beklemede, tamamlandi, birakildi) */
  move(id: number, status: string): { row: OwnProjectRecord; effects: string[] };
  /** its ideas fall back to the general list (restoring ties them back) */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** "convert to project": a top level general idea becomes a project through the ideas module, its sub ideas become the project's ideas */
  fromIdea(ideaId: number): { row: OwnProjectRecord; effects: string[] };
  /** filters: status and sellable (comma separated lists), sector; q searches name, description and notes; active first */
  list(opts: ListOpts): { rows: OwnProjectStats[]; total: number };
  get(id: number): OwnProjectStats | undefined;
  /** the stored row of one project */
  ref(id: number): OwnProjectRecord | undefined;
  /** every project with its idea counts and sectors */
  stats(): OwnProjectStats[];
}
