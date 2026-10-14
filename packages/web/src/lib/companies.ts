// Companies screen: segments, money, sort, the stream of a company and the loose touches.
// Segment and money come from core (the companies module); the screen joins the people, projects and threads it already loads.
import { useMemo } from "react";
import { run } from "../api/actions";
import { useCompanies, usePeople, useProjects, useThreads } from "../api/keys";
import type { Comment, Company, CompanyCard, Person, Project, Thread, Touch } from "../api/types";
import { daysFrom, fmtMonth, initials, norm, todayIso } from "./format";
import { channelName } from "./network";
import { LUKEWARM_DAYS } from "./people";

/** Tiles drawn per step: the list can pass 300 companies, "daha fazla" adds the next step */
export const TILE_PAGE = 48;
/** People avatars drawn on a tile */
export const TILE_AVATARS = 4;
/** Last touch older than this many days reads in the cold colour */
export const COLD_DAYS = LUKEWARM_DAYS;
/** Addresses named in the line of the loose touches card */
export const LOOSE_NAMED = 3;
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

export type Influence = NonNullable<Person["influence"]>;
export const INFLUENCE_LABEL: Record<Influence, string> = { karar_verici: "Karar verici", etkileyici: "Etkileyici", kullanici: "Kullanıcı" };
export const INFLUENCE_TONE: Record<Influence, "payment" | "opportunity" | "neutral"> = { karar_verici: "payment", etkileyici: "opportunity", kullanici: "neutral" };

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

/** Days since an ISO time (0 for today and for the future) */
export const daysSince = (iso: string) => Math.max(0, -daysFrom(iso, todayIso()));

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

export const lastText = (days: number | null) => (days === null ? "Temas yok" : days <= 1 ? (days === 0 ? "bugün" : "dün") : `${days} gün önce`);

/** Warmth word of the board for the colour of an org card dot: none, hot, mid, cold */
export const warmthOf = (days: number | null): "none" | "hot" | "mid" | "cold" =>
  days === null ? "none" : days <= 7 ? "hot" : days <= COLD_DAYS ? "mid" : "cold";

// ------------------------------------------------------------ overlay
/** Ask Claude for a message draft to the right person of the company (a task for Claude) */
export const askCompanyDraft = (c: Pick<Company, "id" | "name">) =>
  run("post", "/tasks", { title: `${c.name} için mesaj taslağı hazırla`, assignee: "claude", due_date: todayIso(), company_id: c.id }, { ok: "Claude doğru kişiye taslak yazıyor, Taslaklar’a düşecek" });

/** Channel of a new touch: the one used last, else e-mail when the company has an address, else other */
export const touchChannel = (card: CompanyCard | undefined, c: Company) => card?.channels[0]?.channel ?? (c.email ? "email" : "diger");

export interface StreamItem {
  key: string;
  kind: "person" | "me" | "claude";
  /** initials of the avatar */
  ini: string;
  who: string;
  at: string;
  text: string;
  touch?: Touch;
  comment?: Comment;
  thread?: Thread;
}

const CLAUDE_INI = "CL";
const ME_INI = "ÖD";

/** Touches (to the company and its people) and the comments of its threads, newest first */
export function buildStream(card: CompanyCard): StreamItem[] {
  const items: StreamItem[] = [
    ...card.touches.rows.map((t): StreamItem => {
      const name = t.person_name ?? t.company_name ?? t.to_name;
      const text = t.outcome ? `${t.summary} → ${t.outcome}` : t.summary;
      if (t.created_by === "claude") return { key: `t${t.id}`, kind: "claude", ini: CLAUDE_INI, who: `Claude · ${t.to_name}`, at: t.happened_at, text, touch: t };
      if (t.direction === "gelen") return { key: `t${t.id}`, kind: "person", ini: initials(name), who: `${name} · ${channelName(t.channel)}`, at: t.happened_at, text, touch: t };
      return { key: `t${t.id}`, kind: "me", ini: ME_INI, who: `Sen · ${t.to_name}`, at: t.happened_at, text, touch: t };
    }),
    ...card.threads.flatMap((th) => (th.comments ?? []).map((c): StreamItem => (c.created_by === "claude"
      ? { key: `c${c.id}`, kind: "claude", ini: CLAUDE_INI, who: "Claude yorumu", at: c.created_at, text: c.body, comment: c, thread: th }
      : { key: `c${c.id}`, kind: "me", ini: ME_INI, who: "Claude’a yazdın", at: c.created_at, text: c.body, comment: c, thread: th }))),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ------------------------------------------------------------ loose touches
export interface LooseGroup {
  contact: string;
  count: number;
  last: string;
  replied: boolean;
  match: NonNullable<Touch["suggested_match"]> | null;
}

/** Address-only touches grouped by address: replies first, then the newest */
export function groupLoose(rows: Touch[]): LooseGroup[] {
  const m = new Map<string, LooseGroup>();
  for (const t of rows) {
    const k = t.contact ?? "";
    const g = m.get(k) ?? { contact: k, count: 0, last: t.happened_at, replied: false, match: null };
    g.count++;
    if (t.happened_at > g.last) g.last = t.happened_at;
    if (t.direction === "gelen") g.replied = true;
    g.match ??= t.suggested_match ?? null;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => Number(b.replied) - Number(a.replied) || b.last.localeCompare(a.last));
}

/** "a, b ve c": the first addresses named, the rest counted */
export function namedAddresses(groups: LooseGroup[]): string {
  const names = groups.slice(0, LOOSE_NAMED).map((g) => g.contact);
  const rest = groups.length - names.length;
  const head = names.length > 1 ? `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}` : names[0] ?? "";
  return rest > 0 ? `${names.join(", ")} ve ${rest} adres daha` : head;
}
