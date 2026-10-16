// Client projects screen: tabs, the milestone money track, who a project waits on, and the one-pass join of
// projects, payments, tasks and comment threads (everything is loaded once and joined in memory, no fetch per row).
import { useMemo } from "react";
import { run } from "@kit/api/actions";
import { useProjects, useThreads } from "@kit/api/keys";
import { drained } from "@kit/api/paged";
import { useQuery } from "@kit/api/store";
import type { List, Payment, ProjectTask, ProjectTaskGroup, Thread } from "@kit/api/types";
import type { ProjectRow, WaitKey } from "./types";
import { ACTIVE_PROJECT_STAGES, lateDays, remaining } from "@kit/lib/dashboard";
import { daysFrom, lira, todayIso } from "@kit/lib/format";
import { LOCALE } from "@kit/lib/i18n";
import { MILESTONE, PROJECT_STEPS, type ProjectStage } from "@kit/lib/labels";
import { m } from "./messages";

export type TabKey = "aktif" | "bakim" | "teslim" | "iptal";
/** Tabs as the board groups the stages: active work, maintenance, delivered (cancelled shows only when there are some) */
export const TABS: { key: TabKey; label: string; stages: readonly string[] }[] = [
  { key: "aktif", label: m.tabs.active, stages: ACTIVE_PROJECT_STAGES },
  { key: "bakim", label: m.tabs.maintenance, stages: ["bakim"] },
  { key: "teslim", label: m.tabs.delivered, stages: ["teslim"] },
  { key: "iptal", label: m.tabs.cancelled, stages: ["iptal"] },
];
const tabOf = (stage: ProjectStage) => TABS.find((t) => t.stages.includes(stage))!.key;

/** A milestone whose money is due no later than this many steps after the current stage reads as "coming" (warning colour) */
const MONEY_AHEAD_STEPS = 1;
const DELIVERED_STEP = PROJECT_STEPS.indexOf("teslim");

/** The three waiting cards; core gives each project its waiting state and held money */
export const WAIT_CARDS: { key: WaitKey; label: string; sub: string }[] = [
  { key: "me", label: m.wait.me, sub: m.wait.meSub },
  { key: "client", label: m.wait.client, sub: m.wait.clientSub },
  { key: "late", label: m.wait.late, sub: m.wait.lateSub },
];
export const WAIT_CHIP: Record<WaitKey, string> = { me: m.wait.chipMe, client: m.wait.chipClient, late: m.wait.chipLate };
const FROM_CORE: Record<string, WaitKey> = { sende: "me", musteride: "client", gecikti: "late" };

export type MoneyState = "paid" | "late" | "soon" | "later";
export interface StepView {
  stage: ProjectStage;
  done: boolean;
  now: boolean;
  /** TL tied to this milestone (0 = none) */
  money: number;
  state: MoneyState;
  /** the line to the previous step is drawn in the accent colour */
  lineOn: boolean;
}
export interface PayView {
  payment: Payment;
  state: MoneyState;
  /** the one next to be collected: the first unpaid milestone */
  canMark: boolean;
}
export interface ProjectView {
  p: ProjectRow;
  tab: TabKey;
  got: number;
  total: number;
  steps: StepView[];
  wait: WaitKey | null;
  /** TL the current wait holds */
  held: number;
  /** "Bitti" chip: delivered and nothing waits */
  finished: boolean;
  next: string;
  tasks: ProjectTask[];
  pays: PayView[];
  note: string | null;
  comments: number;
  /** the Claude request offered on the row: a payment reminder, or a plan when the work waits on the owner */
  ask: { title: string; label: string; ok: string; requested: boolean };
}

export const reminderTitle = m.ask.reminderTitle;
const planTitle = m.ask.planTitle;

/** Gives Claude a task on a project; the result shows up in Taslaklar or the plan */
export function askClaude(projectId: number, title: string, ok: string) {
  return run("post", "/tasks", { title, assignee: "claude", due_date: todayIso(), project_id: projectId }, { ok }).catch(() => {});
}
export const requestReminder = (projectId: number, name: string) => askClaude(projectId, reminderTitle(name), m.ask.reminderOk);

/** Claude's own tasks (a requested draft or plan) never put a project on hold for the owner or the client */
const humanTask = (t: ProjectTask) => t.assignee !== "claude";
const stepIndex = (milestone: string) => PROJECT_STEPS.indexOf(milestone as ProjectStage);
const byMilestone = (a: Payment, b: Payment) => stepIndex(a.milestone) - stepIndex(b.milestone) || a.id - b.id;
const byDue = (a: { due_date: string | null; id: number }, b: { due_date: string | null; id: number }) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id - b.id;

function groupBy<T>(rows: T[], key: (r: T) => number | null): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (k === null) continue;
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }
  return groups;
}

/** Who the project waits on and the money that wait holds: core works both out (projects module), the screen only maps them */
const waitOf = (p: ProjectRow): { wait: WaitKey | null; held: number } => ({ wait: p.waiting ? FROM_CORE[p.waiting] : null, held: p.waiting_amount });

function nextText(pays: Payment[], open: ProjectTask[], today: string): string {
  const late = pays.filter((x) => x.status === "gecikmis").sort(byDue)[0];
  if (late) return m.next.latePayment(lira(remaining(late)), (MILESTONE[late.milestone] ?? late.milestone).toLocaleLowerCase(LOCALE), lateDays(late, today));
  const lateTask = open.filter((t) => humanTask(t) && t.due_date && t.due_date < today).sort(byDue)[0];
  if (lateTask) return m.next.lateTask(lateTask.title, -daysFrom(lateTask.due_date!, today));
  const next = open.find(humanTask) ?? open[0];
  if (next) return next.title;
  const unpaid = pays.find((x) => x.status !== "odendi");
  if (unpaid) return m.next.waiting(MILESTONE[unpaid.milestone] ?? unpaid.milestone);
  return pays.length ? m.next.paid : m.next.none;
}

function stepsOf(p: ProjectRow, pays: Payment[]): StepView[] {
  const idx = PROJECT_STEPS.indexOf(p.stage);
  const delivered = p.stage === "teslim";
  return PROJECT_STEPS.map((stage, i) => {
    const ps = pays.filter((x) => x.milestone === stage);
    const money = ps.reduce((a, x) => a + x.expected_amount, 0);
    const state: MoneyState = !money ? "later" : ps.every((x) => x.status === "odendi") ? "paid" : ps.some((x) => x.status === "gecikmis") ? "late"
      : idx >= 0 && i <= idx + MONEY_AHEAD_STEPS ? "soon" : "later";
    return { stage, money, state, done: i < idx || (delivered && i <= DELIVERED_STEP), now: i === idx && !delivered, lineOn: i <= idx };
  });
}

/** Comment count and Claude's latest note per project, from the open threads that are already loaded */
function threadsByProject(threads: Thread[]) {
  const byProject = new Map<number, { count: number; note: string | null; at: string }>();
  for (const t of threads) {
    if (t.target_type !== "project") continue;
    const cur = byProject.get(t.target_id) ?? { count: 0, note: null, at: "" };
    cur.count += t.count;
    if (t.last_by === "claude" && t.last_at > cur.at) { cur.note = t.last_body; cur.at = t.last_at; }
    byProject.set(t.target_id, cur);
  }
  return byProject;
}

export function buildViews(projects: ProjectRow[], payments: Payment[], tasks: ProjectTask[], threads: Thread[], today: string): ProjectView[] {
  const paysBy = groupBy(payments, (x) => x.project_id);
  const tasksBy = groupBy(tasks, (t) => t.project_id);
  const talk = threadsByProject(threads);
  return projects.map((p) => {
    const pays = (paysBy.get(p.id) ?? []).sort(byMilestone);
    const all = (tasksBy.get(p.id) ?? []).sort((a, b) => a.id - b.id);
    const open = all.filter((t) => !t.done_at).sort(byDue);
    const { wait, held } = waitOf(p);
    const mark = pays.find((x) => x.status !== "odendi")?.id;
    const steps = stepsOf(p, pays);
    const stateOf = (x: Payment): MoneyState => steps[stepIndex(x.milestone)]?.state === "paid" || x.status === "odendi" ? "paid" : x.status === "gecikmis" ? "late"
      : steps[stepIndex(x.milestone)]?.state === "soon" ? "soon" : "later";
    const title = wait === "me" ? planTitle(p.name) : reminderTitle(p.name);
    const requested = open.some((t) => t.assignee === "claude" && t.title === title);
    return {
      p, tab: tabOf(p.stage), got: p.paid_total, total: p.expected_total || p.price, steps, wait, held,
      finished: !wait && p.stage === "teslim", next: nextText(pays, open, today), tasks: all,
      pays: pays.map((x) => ({ payment: x, state: stateOf(x), canMark: x.id === mark })),
      note: talk.get(p.id)?.note ?? null, comments: talk.get(p.id)?.count ?? 0,
      ask: { title, label: requested ? m.ask.requested : wait === "me" ? m.ask.plan : m.ask.reminder, ok: wait === "me" ? m.ask.planOk : m.ask.reminderOk, requested },
    };
  });
}

/** The tasks of every project, open and done (the screen shows both), grouped by project: the calendar module's endpoint, no list cap */
const TASKS_KEY = "/tasks/by-project?done=true";
const PAYMENTS_KEY = "/payments";

/** The whole screen's data in one place: four shared lists, joined once per change */
export function useProjectViews() {
  const projects = useProjects();
  const payments = useQuery<List<Payment>>(PAYMENTS_KEY, drained);
  const tasks = useQuery<{ rows: ProjectTaskGroup[] }>(TASKS_KEY);
  const threads = useThreads();
  const views = useMemo(
    () => buildViews(projects.rows as ProjectRow[], payments.data?.rows ?? [], tasks.data?.rows.flatMap((g) => g.tasks) ?? [], threads.rows, todayIso()),
    [projects.rows, payments.data, tasks.data, threads.rows],
  );
  // the tasks are optional (the calendar module may be gone): the screen waits for their answer, not for their data
  const ready = !!projects.data && !!payments.data && !tasks.loading;
  const error = projects.error ?? payments.error;
  return { views, ready, error, reload: () => Promise.all([projects.reload(), payments.reload(), tasks.reload()]).then(() => undefined) };
}

/** Whether any project waits on the client or has a task of the client: the "Müşteride" card appears only then */
export const hasClientTasks = (views: ProjectView[]) => views.some((v) => v.tasks.some((t) => t.assignee === "musteri" && !t.done_at)) || views.some((v) => v.p.waiting === "musteride");

/** Project count and held money per wait, for the three cards */
export function summarize(views: ProjectView[]): Record<WaitKey, { count: number; money: number }> {
  const out = { me: { count: 0, money: 0 }, client: { count: 0, money: 0 }, late: { count: 0, money: 0 } };
  for (const v of views) {
    if (!v.wait) continue;
    out[v.wait].count++;
    out[v.wait].money += v.held;
  }
  return out;
}
