// Companies screen: segments, money, sort and the ask for a draft.
// Segment and money come from core (the companies module); the screen joins the people, projects and threads it already loads.
import { useMemo } from "react";
import { run } from "@kit/api/actions";
import { useCompanies, usePeople, useProjects, useThreads } from "@kit/api/keys";
import type { Company, Person, Project, Thread } from "@kit/api/types";
import { fmtMonth, norm, todayIso } from "@kit/lib/format";
import { daysSince } from "@kit/lib/people";

/** Tiles drawn per step: the list can pass 300 companies, "daha fazla" adds the next step */
export const TILE_PAGE = 48;
/** People avatars drawn on a tile */
export const TILE_AVATARS = 4;
/** Companies named under "Karar vericiye ulaşılmamış" */
export const UNREACHED_NAMED = 2;

export type Segment = Company["segment"];
export type SegmentFilter = "all" | Segment;
export const SEGMENT_LABEL: Record<Segment, string> = { client: "Müşteri", lead: "Aday", partner: "Partner" };
export const SEGMENT_FILTERS: { key: SegmentFilter; label: string }[] = [
  { key: "all", label: "Hepsi" },
  { key: "client", label: SEGMENT_LABEL.client },
  { key: "lead", label: SEGMENT_LABEL.lead },
  { key: "partner", label: SEGMENT_LABEL.partner },
];

export type SortKey = "value" | "recent" | "name";
export const SORTS: { key: SortKey; label: string }[] = [
  { key: "value", label: "Değer" },
  { key: "recent", label: "Son temas" },
  { key: "name", label: "İsim" },
];


/** Paid on the projects of the company, the unpaid part of their payments, the estimated value of its open opportunities */
export type Money = Company["money"];

export interface CompanyView {
  c: Company;
  segment: Segment;
  money: Money;
  total: number;
  /** people of the company, the most recently touched first */
  people: Person[];
  projects: Project[];
  /** latest open comment of Claude on the company */
  hint: string | null;
  /** days since the last touch, null when there is none */
  days: number | null;
  /** first project start (else null) as a month label */
  since: string | null;
}

interface Inputs {
  companies: Company[];
  people: Person[];
  projects: Project[];
  threads: Thread[];
}

export function buildViews({ companies, people, projects, threads }: Inputs): CompanyView[] {
  const companyOfPerson = new Map(people.map((p) => [p.id, p.company_id]));
  const group = <T,>(into: Map<number, T[]>, key: number | null | undefined, item: T) => {
    if (!key) return;
    const list = into.get(key);
    if (list) list.push(item);
    else into.set(key, [item]);
  };
  const peopleOf = new Map<number, Person[]>();
  for (const p of people) group(peopleOf, p.company_id, p);
  const projectsOf = new Map<number, Project[]>();
  for (const p of projects) group(projectsOf, companyOfPerson.get(p.person_id), p);
  const hintOf = new Map<number, string>();
  for (const t of threads) if (t.target_type === "company" && !t.resolved_at && t.last_by === "claude" && !hintOf.has(t.target_id)) hintOf.set(t.target_id, t.last_body);

  return companies.map((c) => {
    const own = projectsOf.get(c.id) ?? [];
    const started = own.map((p) => p.started_at).filter((d): d is string => !!d).sort()[0];
    return {
      c,
      segment: c.segment,
      money: c.money,
      total: c.money.won + c.money.due + c.money.open,
      people: (peopleOf.get(c.id) ?? []).sort((a, b) => (b.last_touch_at ?? "").localeCompare(a.last_touch_at ?? "")),
      projects: own,
      hint: hintOf.get(c.id) ?? null,
      days: c.last_touch_at ? daysSince(c.last_touch_at) : null,
      since: started ? fmtMonth(started.slice(0, 7)) : null,
    };
  });
}

/** Everything the screen needs, joined once in memory: the companies with their segment and money from core, their people, projects and threads */
export function useCompanyViews() {
  const companies = useCompanies();
  const people = usePeople();
  const projects = useProjects();
  const threads = useThreads();
  const views = useMemo(
    () => buildViews({ companies: companies.rows, people: people.rows, projects: projects.rows, threads: threads.rows }),
    [companies.rows, people.rows, projects.rows, threads.rows],
  );
  const byId = useMemo(() => new Map(views.map((v) => [v.c.id, v])), [views]);
  return { views, byId, companies, ready: !!companies.data };
}

// ------------------------------------------------------------ list
export function searchText(v: CompanyView): string {
  const c = v.c;
  return norm([c.name, c.sector_path, c.city, c.website, c.email, c.tags.join(" ")].filter(Boolean).join(" "));
}

const byValue = (a: CompanyView, b: CompanyView) => b.total - a.total;
export const SORT: Record<SortKey, (a: CompanyView, b: CompanyView) => number> = {
  value: byValue,
  recent: (a, b) => (a.days ?? Infinity) - (b.days ?? Infinity) || byValue(a, b),
  name: (a, b) => a.c.name.localeCompare(b.c.name, "tr"),
};

export interface Totals {
  won: number;
  due: number;
  dueCompanies: number;
  open: number;
  openCompanies: number;
  /** companies with a decision maker nobody has touched yet */
  unreached: string[];
  /** people marked as a decision maker, in all companies */
  deciders: number;
}

export function totalsOf(views: CompanyView[]): Totals {
  const t: Totals = { won: 0, due: 0, dueCompanies: 0, open: 0, openCompanies: 0, unreached: [], deciders: 0 };
  for (const v of views) {
    t.won += v.money.won;
    t.due += v.money.due;
    t.open += v.money.open;
    if (v.money.due > 0) t.dueCompanies++;
    if (v.money.open > 0) t.openCompanies++;
    t.deciders += v.people.filter((p) => p.influence === "karar_verici").length;
    if (v.people.some((p) => p.influence === "karar_verici" && !p.last_touch_at)) t.unreached.push(v.c.name);
  }
  return t;
}

/** Website as shown: without scheme and trailing slash */
export const siteLabel = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");

// ------------------------------------------------------------ overlay
/** Ask Claude for a message draft to the right person of the company (a task for Claude) */
export const askCompanyDraft = (c: Pick<Company, "id" | "name">) =>
  run("post", "/tasks", { title: `${c.name} için mesaj taslağı hazırla`, assignee: "claude", due_date: todayIso(), company_id: c.id }, { ok: "Claude doğru kişiye taslak yazıyor, Taslaklar’a düşecek" });
