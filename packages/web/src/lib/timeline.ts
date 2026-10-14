// Timeline (Zaman çizelgesi): the global feed, its filters, the day groups and the week strip.
// Gap: core has no global event feed yet. The rows are built here from the lists the other screens already load
// (touches, drafts, comment threads, done tasks, payments, opportunities, projects), one request per list,
// never one per record. The week strip (G23) is derived from those same rows. Both move into core with the timeline module.
import { useMemo } from "react";
import { K, useOpps, useProjects } from "../api/keys";
import { useQuery } from "../api/store";
import type {
  Draft, List, Opportunity, Payment, Project, Task, Thread, TimelineEvent, TlItem, TlRec, TlType, TlWeek, Touch,
} from "../api/types";
import { BOARD_ICON } from "../components/boardIcons";
import { lira, norm, toDate } from "./format";
import { CHANNEL, MILESTONE, type Actor } from "./labels";

const ALL = 1000;
const KEYS = {
  touches: `/touches?limit=${ALL}`,
  doneTasks: `/tasks?done=true&limit=${ALL}`,
  payments: `/payments?limit=${ALL}`,
};
/** Events requested for a focused record: enough to hold its whole stage history */
export const STAGE_EVENTS_LIMIT = 500;
/** Rows shown before "Daha eski olaylar" asks for more, and how many each press adds */
export const TL_PAGE = 60;
/** Comment and draft text are cut to this many characters in a row */
const TEXT_MAX = 240;
const DRAFT_TEXT_MAX = 90;
const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;

// ------------------------------------------------------------ types and records
const PAY_ICON = "M3 7h18v10H3zM3 10h18M7 14h3";
const COMMENT_LINES_ICON = "M8 10h8M8 14h5M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z";
const PERSON_ICON = "M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5";

/** Type pills and row icons, in the board's order */
export const TL_TYPES: { key: TlType; label: string; icon: string }[] = [
  { key: "temas", label: "Temas", icon: BOARD_ICON.comment },
  { key: "odeme", label: "Ödeme", icon: PAY_ICON },
  { key: "gorev", label: "Görev", icon: BOARD_ICON.check },
  { key: "asama", label: "Aşama", icon: BOARD_ICON.arrowRight },
  { key: "taslak", label: "Taslak", icon: BOARD_ICON.pen },
  { key: "yorum", label: "Yorum", icon: COMMENT_LINES_ICON },
];
export const TL_TYPE = Object.fromEntries(TL_TYPES.map((t) => [t.key, t])) as Record<TlType, (typeof TL_TYPES)[number]>;

export const ACTOR_PILLS: { value: "all" | Actor; label: string }[] = [
  { value: "all", label: "Hepsi" },
  { value: "ozgur", label: "Sen" },
  { value: "claude", label: "Claude" },
];

export interface RecKind {
  label: string;
  icon: string;
  /** the chip focuses the record (and the address /zaman/:kind/:id opens it) */
  focus: boolean;
}
export const REC_KIND: Record<string, RecKind> = {
  project: { label: "Proje", icon: BOARD_ICON.folder, focus: true },
  person: { label: "Kişi", icon: PERSON_ICON, focus: true },
  company: { label: "Firma", icon: BOARD_ICON.building, focus: true },
  opportunity: { label: "Fırsat", icon: BOARD_ICON.funnel, focus: true },
  own_project: { label: "Kendi projem", icon: BOARD_ICON.cube, focus: true },
  idea: { label: "Fikir", icon: BOARD_ICON.bulb, focus: false },
  post: { label: "Paylaşım", icon: BOARD_ICON.megaphone, focus: false },
  template: { label: "Şablon", icon: BOARD_ICON.template, focus: false },
};
const OTHER_KIND: RecKind = { label: "Kayıt", icon: BOARD_ICON.note, focus: false };
export const recKind = (kind: string) => REC_KIND[kind] ?? OTHER_KIND;
/** Colour key of a record kind (data-rec): the five focusable kinds have their own, the rest share one */
export const recTone = (kind: string) => (REC_KIND[kind]?.focus ? kind : "other");
/** Records that have a detail page and an event list behind the API: the focus view adds their side cards */
export const ASIDE_KINDS = ["person", "opportunity", "project"] as const;
export type AsideKind = (typeof ASIDE_KINDS)[number];
export const isAsideKind = (k: string | undefined): k is AsideKind => ASIDE_KINDS.includes(k as AsideKind);

const rec = (kind: string, id: number, name: string): TlRec => ({ key: `${kind}:${id}`, kind, id, name });

// ------------------------------------------------------------ time
const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
const clock = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const pad = (n: number) => String(n).padStart(2, "0");
export const fmtClock = (ms: number) => clock.format(ms);
/** Local day of an instant, "2026-10-13" */
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** "Bugün · 13 Ekim", "Dün · 12 Ekim", "Cumartesi · 11 Ekim" (the year only when it is not this one) */
function dayTitle(key: string, now: number) {
  const day = toDate(key);
  if (key === dayKey(now)) return `Bugün · ${dayMonth.format(day)}`;
  if (key === dayKey(now - DAY_MS)) return `Dün · ${dayMonth.format(day)}`;
  const name = weekday.format(day);
  const cap = name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1);
  return `${cap} · ${(day.getFullYear() === new Date(now).getFullYear() ? dayMonth : dayMonthYear).format(day)}`;
}

// ------------------------------------------------------------ building rows
const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);
const DRAFT_STATUS: Record<Draft["status"], string> = { bekliyor: "onay bekliyor", onaylandi: "onaylandı", gonderildi: "gönderildi", reddedildi: "reddedildi" };

interface Links {
  person_id?: number | null;
  person_name?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  opportunity_id?: number | null;
  opportunity_title?: string | null;
  project_id?: number | null;
  project_name?: string | null;
}
interface Index {
  opps: Map<number, Opportunity>;
  projects: Map<number, Project>;
}

/** The chip record (project before opportunity before person before company) and every record a row belongs to */
function recordsOf(l: Links, ix: Index): { rec: TlRec | null; refs: string[] } {
  const proj = l.project_id ? ix.projects.get(l.project_id) : undefined;
  const oppId = l.opportunity_id ?? proj?.opportunity_id ?? null;
  const opp = oppId ? ix.opps.get(oppId) : undefined;
  const personId = l.person_id ?? proj?.person_id ?? opp?.person_id ?? null;
  const refs = [
    l.project_id && `project:${l.project_id}`, oppId && `opportunity:${oppId}`,
    personId && `person:${personId}`, l.company_id && `company:${l.company_id}`,
  ].filter(Boolean) as string[];
  const projName = l.project_name ?? proj?.name;
  const oppName = l.opportunity_title ?? opp?.title;
  const found =
    (l.project_id && projName ? rec("project", l.project_id, projName) : null) ??
    (oppId && oppName ? rec("opportunity", oppId, oppName) : null) ??
    (l.person_id && l.person_name ? rec("person", l.person_id, l.person_name) : null) ??
    (l.company_id && l.company_name ? rec("company", l.company_id, l.company_name) : null);
  return { rec: found, refs };
}

/** A payment knows its day; the clock shows only when the row was last written on that day */
function paidWhen(p: Payment): { at: number; timed: boolean } {
  const wrote = Date.parse(p.updated_at);
  if (p.paid_at && !Number.isNaN(wrote) && dayKey(wrote) === p.paid_at) return { at: wrote, timed: true };
  return { at: toDate(p.paid_at ?? p.updated_at).getTime(), timed: false };
}

interface Sources {
  touches: Touch[];
  drafts: Draft[];
  threads: Thread[];
  doneTasks: Task[];
  payments: Payment[];
  opps: Opportunity[];
  projects: Project[];
}

export function buildItems(s: Sources): TlItem[] {
  const ix: Index = { opps: new Map(s.opps.map((o) => [o.id, o])), projects: new Map(s.projects.map((p) => [p.id, p])) };
  const out: TlItem[] = [];
  for (const t of s.touches) {
    out.push({ key: `t${t.id}`, at: Date.parse(t.happened_at), timed: true, type: "temas", by: t.created_by, text: `${CHANNEL[t.channel] ?? t.channel}: ${t.summary}`, ...recordsOf(t, ix) });
  }
  for (const d of s.drafts) {
    out.push({
      key: `d${d.id}`, at: Date.parse(d.created_at), timed: true, type: "taslak", by: d.created_by, approved: d.status === "onaylandi" || d.status === "gonderildi",
      text: `${CHANNEL[d.channel] ?? d.channel} taslağı yazıldı, ${DRAFT_STATUS[d.status]}: ${cut(d.body, DRAFT_TEXT_MAX)}`,
      // a draft to a company or a bare address carries it as to_name
      ...recordsOf({ ...d, company_name: d.to_name }, ix),
    });
  }
  for (const th of s.threads) {
    const target = rec(th.target_type, th.target_id, th.target_label);
    const links: Links = th.target_type === "opportunity" ? { opportunity_id: th.target_id } : th.target_type === "project" ? { project_id: th.target_id } : {};
    const linked = recordsOf(links, ix).refs;
    for (const c of th.comments ?? []) {
      out.push({ key: `c${c.id}`, at: Date.parse(c.created_at), timed: true, type: "yorum", by: c.created_by, text: cut(c.body, TEXT_MAX), rec: target, refs: [...new Set([target.key, ...linked])] });
    }
  }
  for (const t of s.doneTasks) {
    if (!t.done_at) continue;
    out.push({ key: `k${t.id}`, at: toDate(t.done_at).getTime(), timed: t.done_at.length > 10, type: "gorev", by: t.assignee, text: t.title, ...recordsOf(t, ix) });
  }
  for (const p of s.payments) {
    if (p.paid_amount <= 0) continue;
    out.push({
      key: `p${p.id}`, ...paidWhen(p), type: "odeme", by: p.created_by, amount: p.paid_amount,
      text: `${MILESTONE[p.milestone] ?? p.milestone} ödemesi alındı${p.status === "kismi" ? " (kısmi)" : ""}`,
      ...recordsOf(p, ix),
    });
  }
  for (const o of s.opps) {
    out.push({ key: `o${o.id}`, at: Date.parse(o.created_at), timed: true, type: "asama", by: o.created_by, text: `Fırsat açıldı: ${o.title}`, ...recordsOf({ opportunity_id: o.id, opportunity_title: o.title, person_id: o.person_id }, ix) });
  }
  for (const p of s.projects) {
    out.push({ key: `r${p.id}`, at: Date.parse(p.created_at), timed: true, type: "asama", by: p.created_by, text: `Proje açıldı: ${p.name}`, ...recordsOf({ project_id: p.id, project_name: p.name }, ix) });
  }
  return sortFeed(out.filter((i) => !Number.isNaN(i.at)));
}

const sortFeed = (list: TlItem[]) => list.sort((a, b) => b.at - a.at || (a.key < b.key ? 1 : -1));

/** The focus view of a person, opportunity or project reads its true stage history from the event list
 *  and replaces the stage rows derived from the lists. */
export function withStageEvents(items: TlItem[], focus: TlRec, events: TimelineEvent[] | undefined, opps: Map<number, Opportunity>, projects: Map<number, Project>): TlItem[] {
  if (!events) return items;
  const stage = events.filter((e) => /^(opp|project)\.(created|stage)$/.test(e.type)).map((e): TlItem => {
    const proj = e.project_id ? projects.get(e.project_id) : undefined;
    const opp = e.opportunity_id ? opps.get(e.opportunity_id) : undefined;
    const own = (proj && rec("project", proj.id, proj.name)) || (opp && rec("opportunity", opp.id, opp.title)) || focus;
    const refs = [focus.key, e.project_id && `project:${e.project_id}`, e.opportunity_id && `opportunity:${e.opportunity_id}`, e.person_id && `person:${e.person_id}`].filter(Boolean) as string[];
    return { key: `e${e.id}`, at: Date.parse(e.created_at), timed: true, type: "asama", by: e.created_by, text: e.summary, rec: own, refs: [...new Set(refs)] };
  });
  return sortFeed([...items.filter((i) => !(i.type === "asama" && i.refs.includes(focus.key))), ...stage]);
}

// ------------------------------------------------------------ data
/** One request per list; the lists are shared with the other screens through the query cache */
export function useTimelineFeed() {
  const touches = useQuery<List<Touch>>(KEYS.touches);
  const drafts = useQuery<List<Draft>>(K.drafts);
  const threads = useQuery<List<Thread>>(K.allThreads);
  const doneTasks = useQuery<List<Task>>(KEYS.doneTasks);
  const payments = useQuery<List<Payment>>(KEYS.payments);
  const opps = useOpps();
  const projects = useProjects();
  const all = [touches, drafts, threads, doneTasks, payments, opps, projects];
  const ready = all.every((q) => q.data);
  const error = all.find((q) => q.error && !q.data)?.error;
  const items = useMemo(() => {
    if (!ready) return [];
    return buildItems({
      touches: touches.data!.rows, drafts: drafts.data!.rows, threads: threads.data!.rows, doneTasks: doneTasks.data!.rows,
      payments: payments.data!.rows, opps: opps.rows, projects: projects.rows,
    });
  }, [ready, touches.data, drafts.data, threads.data, doneTasks.data, payments.data, opps.rows, projects.rows]);
  const reload = () => all.forEach((q) => void q.reload());
  return { items, ready, error, reload, touches: touches.data?.rows ?? [], threads: threads.data?.rows ?? [], opps, projects };
}

// ------------------------------------------------------------ filters and groups
export interface TlFilter {
  actor: "all" | Actor;
  hidden: ReadonlySet<TlType>;
  focus: string | null;
  q: string;
}

export function filterFeed(items: TlItem[], f: TlFilter): TlItem[] {
  const n = norm(f.q.trim());
  return items.filter((i) =>
    (f.actor === "all" || i.by === f.actor) && !f.hidden.has(i.type) && (!f.focus || i.refs.includes(f.focus)) &&
    (!n || norm(`${i.rec?.name ?? ""} ${i.text}`).includes(n)));
}

export interface TlDay {
  key: string;
  title: string;
  /** "3 sen · 2 Claude": every row of the day, whatever the filters */
  sum: string;
  events: TlItem[];
}

/** Rows per day (newest first) and per actor, for the day headers */
export function dayCounts(items: TlItem[]) {
  const m = new Map<string, Record<Actor, number>>();
  for (const i of items) {
    const k = dayKey(i.at);
    const c = m.get(k) ?? { ozgur: 0, claude: 0 };
    c[i.by]++;
    m.set(k, c);
  }
  return m;
}

export function groupDays(shown: TlItem[], counts: Map<string, Record<Actor, number>>, now = Date.now()): TlDay[] {
  const days: TlDay[] = [];
  for (const i of shown) {
    const key = dayKey(i.at);
    let d = days[days.length - 1];
    if (!d || d.key !== key) {
      const c = counts.get(key) ?? { ozgur: 0, claude: 0 };
      d = { key, title: dayTitle(key, now), sum: `${c.ozgur} sen · ${c.claude} Claude`, events: [] };
      days.push(d);
    }
    d.events.push(i);
  }
  return days;
}

/** Focus card line: how many rows, since when, and the latest one */
export function focusSummary(rows: TlItem[], firstAt: string | undefined, now = Date.now()): string {
  const parts = [`${rows.length} olay`];
  if (firstAt) {
    const first = toDate(firstAt);
    parts.push(`ilk kayıt ${dayMonth.format(first)}`, `${Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(first.getTime()).getTime()) / DAY_MS))} gündür takipte`);
  }
  if (rows[0]) parts.push(`son: ${rows[0].text}`);
  return parts.join(" · ");
}

// ------------------------------------------------------------ week strip (G23)
const LAST_WEEK = "geçen hafta";

/** This week (Monday on) against the last one, from the rows already loaded */
export function weekStats(items: TlItem[], now = Date.now()): TlWeek {
  const start = startOfDay(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % WEEK_DAYS));
  const end = new Date(start);
  end.setDate(end.getDate() + WEEK_DAYS);
  const before = new Date(start);
  before.setDate(before.getDate() - WEEK_DAYS);
  const cur = { temas: 0, gorev: 0, odeme: 0, paid: 0, drafts: 0, approved: 0, me: 0, cl: 0 };
  const last = { temas: 0, gorev: 0 };
  for (const i of items) {
    if (i.at >= end.getTime()) continue;
    if (i.at < start.getTime()) {
      if (i.at < before.getTime()) break; // newest first: nothing older can count
      if (i.type === "temas") last.temas++;
      else if (i.type === "gorev") last.gorev++;
      continue;
    }
    if (i.by === "ozgur") cur.me++;
    else cur.cl++;
    if (i.type === "temas") cur.temas++;
    else if (i.type === "gorev") cur.gorev++;
    else if (i.type === "odeme") { cur.odeme++; cur.paid += i.amount ?? 0; }
    else if (i.type === "taslak" && i.by === "claude") { cur.drafts++; if (i.approved) cur.approved++; }
  }
  return {
    me: cur.me, cl: cur.cl,
    tiles: [
      { type: "temas", label: "Temas", value: String(cur.temas), sub: `${LAST_WEEK} ${last.temas}` },
      { type: "odeme", label: "Tahsilat", value: lira(cur.paid), sub: `${cur.odeme} ödeme` },
      { type: "gorev", label: "Biten görev", value: String(cur.gorev), sub: `${LAST_WEEK} ${last.gorev}` },
      { type: "taslak", label: "Claude taslağı", value: String(cur.drafts), sub: `${cur.approved} onaylandı` },
    ],
  };
}
