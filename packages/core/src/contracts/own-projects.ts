import type { OwnProjectStatus, Sellable } from "../constants";
import type { ListOpts } from "../context";

/** Where an own project stands on its journey, in order */
export type OwnProjectStage = "fikir" | "dogrulama" | "demo" | "urun";

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
  /** the journey step; null = not placed yet */
  stage: OwnProjectStage | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** An own project as listed: the row plus its idea counts, interest, next step and sectors */
export interface OwnProjectStats extends OwnProjectRecord {
  open_ideas: number;
  done_ideas: number;
  sectors: { id: number; path: string }[];
  /** distinct people told about any idea of the project, how many of them are interested in one, how many answered (interested or not) */
  told: number;
  interested: number;
  answered: number;
  /** interested / answered, 0 to 1; null while nobody has answered */
  interest_share: number | null;
  /** open high priority ideas, in order; the first is the next step */
  top_ideas: { id: number; title: string }[];
  next_idea: { id: number; title: string } | null;
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
