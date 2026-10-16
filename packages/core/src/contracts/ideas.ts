import type { IdeaPriority, IdeaStage, InterestLevel } from "../constants";
import type { ListOpts } from "../context";
import type { Q } from "../db/client";

/** An idea row as stored: a general money idea (own_project_id null) or an idea of one of the own projects */
export interface IdeaRecord {
  id: number;
  title: string;
  problem: string | null;
  stage: IdeaStage;
  notes: string | null;
  /** sub idea grouping inside general ideas only (one level: a parent has no parent) */
  parent_id: number | null;
  /** the own project this idea belongs to; null = a general idea */
  own_project_id: number | null;
  /** only meaningful inside a project */
  priority: IdeaPriority;
  position: number;
  done_at: string | null;
  /** how the idea earns money, in a sentence */
  money_note: string | null;
  created_at: string;
  updated_at: string;
  created_by: "owner" | "claude";
}

/** An idea as listed: the row plus the interest measure (told, interested), target sectors and what hangs on it */
export interface IdeaStats extends IdeaRecord {
  told: number;
  interested: number;
  not_interested: number;
  touch_count: number;
  post_count: number;
  post_people: number;
  parent_title: string | null;
  own_project_title: string | null;
  child_count: number;
  sectors: { id: number; path: string }[];
  /** interested / told; null while nobody was told */
  interest_rate: number | null;
  /** people who answered: interested or not */
  answered: number;
  /** interested / answered, 0 to 1; null while nobody has answered (the share the verdict reads, unlike `interest_rate`) */
  interest_share: number | null;
  /** how strong the share is: strong, mixed or weak; null while nobody has answered */
  rate_tone: "strong" | "mixed" | "weak" | null;
  /** the sentence under the interest ring: what the numbers say and what to do next */
  verdict: string;
}

/** A person told about an idea (one row per idea and person) and how interested they were */
export interface InterestRecord {
  id: number;
  idea_id: number;
  person_id: number;
  interest: InterestLevel;
  note: string | null;
  /** the touch that told them */
  touch_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: "owner" | "claude";
}

/** An interest row with the names it hangs on */
export interface InterestRow extends InterestRecord {
  person_name: string;
  company_name: string | null;
  idea_title: string;
  idea_stage: IdeaStage;
}

/**
 * Public API of the ideas module (`ctx.mod("ideas")`): money ideas, the people they were told to and how interested they were, and what
 * an idea does when it becomes an own project. A touch about an idea links its person to it (a `touch.created` hook). The inputs are the
 * JSON the web and MCP send; they are validated inside.
 */
export interface IdeasApi {
  create(input: unknown): { row: IdeaRecord; effects: string[] };
  update(id: number, input: unknown): { row: IdeaRecord; effects: string[] };
  /** a stage change (fikir, dogrulaniyor, demo, urun) */
  move(id: number, stage: string): { row: IdeaRecord; effects: string[] };
  /** interest rows and sectors go with it; touches, posts and sub ideas stay and lose the link */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** links a person to an idea (told) or updates the interest; one row per idea and person */
  saveInterest(input: unknown): { row: InterestRecord; effects: string[] };
  updateInterest(id: number, input: unknown): { row: InterestRecord; effects: string[] };
  removeInterest(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** filters: stage, sector, own_project, general; q searches title, problem and notes */
  list(opts: ListOpts): { rows: IdeaStats[]; total: number };
  get(id: number): IdeaStats | undefined;
  /** the stored row of one idea */
  ref(id: number): IdeaRecord | undefined;
  /** every idea with its interest measure (the marketing report) */
  stats(): IdeaStats[];
  /** the people told about an idea (and the ideas told to a person), the ones who are interested first */
  people(ideaId?: number, personId?: number): InterestRow[];
  interests: {
    /** filters: idea_id, person_id, interest; q searches person, idea and note */
    list(opts: ListOpts): { rows: InterestRow[]; total: number };
    get(id: number): InterestRow | undefined;
  };
  /** ids of the sectors an idea targets */
  sectorIds(ideaId: number): number[];
  /**
   * An own project takes an idea over (inside the caller's transaction `q`): the idea's sub ideas move into the project and the idea goes to the trash;
   * returns how many sub ideas moved.
   */
  handOver(q: Q, ideaId: number, projectId: number): number;
}
