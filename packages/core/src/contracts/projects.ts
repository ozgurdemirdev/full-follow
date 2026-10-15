import type { MILESTONES, ProjectStage } from "../constants";
import type { ListOpts } from "../context";
import type { NextTask } from "./calendar";

export type Milestone = (typeof MILESTONES)[number];
export type PaymentStatus = "odendi" | "kismi" | "gecikmis" | "bekliyor";

/** A project row as stored */
export interface ProjectRecord {
  id: number;
  name: string;
  opportunity_id: number | null;
  person_id: number;
  stage: ProjectStage;
  price: number;
  started_at: string | null;
  delivered_at: string | null;
  maintenance_fee: number | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** The next unpaid payment of a project (the board shows it) */
export interface NextPayment {
  id: number;
  milestone: Milestone;
  remaining: number;
  due_date: string | null;
}

/** Who a project waits on: Özgür (sende), the client (musteride) or nobody because something is past due (gecikti) */
export type ProjectWaiting = "sende" | "musteride" | "gecikti";

/**
 * A project as listed: the row plus the person's name, the money so far, the next payment, the next task (null without the calendar module)
 * and who the project waits on (`waiting`, null when nobody) with the TL that wait holds.
 */
export interface ProjectRow extends ProjectRecord {
  person_name: string;
  paid_total: number;
  expected_total: number;
  next_payment: NextPayment | null;
  next_task: NextTask | null;
  waiting: ProjectWaiting | null;
  waiting_amount: number;
}

/** What other modules need to know about a project without loading the list */
export interface ProjectRef {
  id: number;
  name: string;
  person_id: number;
  opportunity_id: number | null;
}

/** A payment row as stored */
export interface PaymentRecord {
  id: number;
  project_id: number;
  milestone: Milestone;
  expected_amount: number;
  due_date: string | null;
  paid_amount: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** A payment as listed: the row plus the names and the computed status (the status is never stored) */
export interface PaymentRow extends PaymentRecord {
  project_name: string;
  person_name: string;
  status: PaymentStatus;
}

/** A payment whose due date falls in a calendar range (paid ones too, they show as done) */
export interface DuePayment {
  id: number;
  project_id: number;
  project_name: string;
  milestone: string;
  expected_amount: number;
  paid_amount: number;
  done: boolean;
  due_date: string;
}

/** What one person's projects add up to */
export interface PersonProjectStats {
  projects: number;
  collected: number;
}

/**
 * Public API of the projects module (`ctx.mod("projects")`): projects, their payments (plan, pay, the deposit rule) and the money reports.
 * A won opportunity opens its project through the `opportunity.won` event, not through this API. The inputs are the JSON the web and MCP send.
 */
export interface ProjectsApi {
  projects: {
    create(input: unknown): { row: ProjectRecord; effects: string[] };
    /** fields; the stage changes through `move`; a changed price plans the payments when there are none */
    update(id: number, input: unknown): { row: ProjectRecord; effects: string[] };
    /** `{ stage }`; the deposit (pesinat) must be paid in full before the project goes past it; going back and cancelling are free */
    move(id: number, input: unknown): { row: ProjectRecord; effects: string[] };
    /** into the trash with its payments; a project with money received stays */
    remove(id: number): { effects: string[]; trash: { type: string; id: number } };
    /** filters: stage, person_id, active */
    list(opts: ListOpts): { rows: ProjectRow[]; total: number };
    get(id: number): ProjectRow | undefined;
    /** a light lookup (one row) */
    ref(id: number): ProjectRef | undefined;
    /** names of these projects (one statement; lists of other modules show them) */
    names(ids: number[]): Map<number, string>;
    /** the project an opportunity became */
    forOpportunity(opportunityId: number): number | undefined;
    /** opportunity id to project id for these opportunities */
    idsForOpportunities(opportunityIds: number[]): Map<number, number>;
    /** how many projects the person has */
    countOf(personId: number): number;
  };
  payments: {
    create(input: unknown): { row: PaymentRecord; effects: string[] };
    /** a correction (paid amount or date); the collection ledger follows through a `payment.corrected` event */
    update(id: number, input: unknown): { row: PaymentRecord; effects: string[] };
    /** adds an amount to what is paid (partial payments work) */
    pay(id: number, amount: unknown, date?: unknown): { row: PaymentRecord; effects: string[] };
    remove(id: number): { effects: string[]; trash: { type: string; id: number } };
    /** filters: project_id, status, overdue, unpaid, due_within_days */
    list(opts: ListOpts): { rows: PaymentRow[]; total: number };
    get(id: number): PaymentRow | undefined;
    /** a light lookup (one row) */
    ref(id: number): { id: number; project_id: number; milestone: Milestone } | undefined;
    /** payments whose due date falls in the range, as the calendar feed lists them */
    due(from: string, to: string): DuePayment[];
  };
  /** money received in a month (YYYY-MM), every payment entry on its own date */
  collectedIn(ym: string): number;
  /** money received from..to (dates, both included), every payment entry on its own date; the one definition of "collected" (reports and the week strip) */
  collectedBetween(from: string, to: string): number;
  /** money still due in a month (YYYY-MM) */
  outstandingDue(ym: string): number;
  /** per person: projects and money received */
  personStats(): Map<number, PersonProjectStats>;
  /** per company (through the people of its projects): the projects it has, the money received and the money still due on them */
  moneyByCompany(): Map<number, CompanyProjectMoney>;
}

/** What a company's projects add up to */
export interface CompanyProjectMoney {
  projects: number;
  paid: number;
  due: number;
}
