import { z } from "zod";
import type { McpDef, McpFormat } from "@fullfollow/core";
import { m } from "./messages";
import { GOAL_NOTE_CHARS, LOG_NOTE_CHARS, PLAN_NOTE_CHARS } from "./service/constants";

type Row = Record<string, any>;

const dayNames = (days: string) =>
  days === "1,2,3,4,5,6,7" ? m.mcp.everyDay : days === "1,2,3,4,5" ? m.mcp.weekdays : days.split(",").map((n) => m.weekdayShort(Number(n) - 1)).join(" ");

/** Auto count of a goal: `(otomatik 8)` for a channel, `(12 eklendi, 3 mükerrer atlandı)` for new records */
const autoText = (g: Row) =>
  g.metric === "new_records" ? (g.auto || g.duplicates ? m.mcp.autoAdded(g.auto, g.duplicates) : "") : g.auto ? m.mcp.autoChannel(g.auto) : "";

/** Günün planı: hedefler (yapılan/hedef), o günün görevleri, seri ve haftalık oran */
function planText(p: any, f: McpFormat): string {
  const goals = p.goals.map((g: Row) => `  #${g.id} ${g.title} ${g.done}/${g.target}${g.complete ? m.mcp.completeMark : ""}${autoText(g)}${g.note ? m.mcp.planGoalNote(f.cut(g.note, PLAN_NOTE_CHARS)) : ""}`);
  const tasks = p.tasks.map((t: Row) => "  " + f.line("task", t));
  const head = f.join(m.mcp.planHead(p.date), p.streak ? m.mcp.streak(p.streak) : "", p.week_ratio !== null && p.week_ratio !== undefined && m.mcp.weekRatio(Math.round(p.week_ratio * 100)));
  return [head, goals.length ? m.mcp.goalsBlock(goals.join("\n")) : m.mcp.noGoals, tasks.length ? m.mcp.tasksBlock(tasks.join("\n")) : ""].filter(Boolean).join("\n");
}

/** Takvim: gün başına bir satır, altında o günün görevleri (id ile, panel sohbeti kart yapabilsin) */
function calendarText(days: Row[], f: McpFormat): string {
  return days.map((c) => [
    f.join(`${f.d(c.date)} ${m.weekdayShort((new Date(`${c.date}T12:00:00Z`).getUTCDay() + 6) % 7)}`,
      c.ratio === null ? m.mcp.noTarget : m.mcp.dayRatio(Math.round(c.ratio * 100)), c.tasks.length && m.mcp.dayTasks(c.tasks.filter((t: Row) => t.done_at).length, c.tasks.length)),
    ...c.tasks.map((t: Row) => "  " + f.line("task", t)),
  ].join("\n")).join("\n");
}

/** How the calendar's records and tool read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["due_time", "assignee"],
  entities: {
    task: {
      kind: m.task,
      openable: true,
      line: (r, f) => f.join(`#${r.id} [${f.who(r.assignee)}] ${r.title}`, r.due_date && m.mcp.due(f.d(r.due_date), r.due_time), r.kind !== "gorev" && r.kind, r.done_at && m.mcp.done, r.person_name || r.company_name || r.opportunity_title || r.project_name || r.idea_title),
    },
    goal: {
      kind: m.goal,
      openable: true,
      line: (r, f) => f.join(`#${r.id} ${r.title}`, m.mcp.perDay(r.target), dayNames(r.days), r.channel && m.mcp.auto(f.label(r.channel)), r.metric && m.mcp.auto(f.label(r.metric)), r.today && m.mcp.today(r.today.done, r.today.target), r.note && m.mcp.note(f.cut(r.note, GOAL_NOTE_CHARS))),
    },
    goal_log: {
      kind: m.goalLog,
      line: (r, f) => f.join(`#${r.id} ${r.goal_title} ${f.d(r.date)}`, m.mcp.manual(r.count), r.note && m.mcp.note(f.cut(r.note, LOG_NOTE_CHARS))),
    },
  },
  relations: { tasks: "task" },
  today: [
    { at: 0, render: (t, f) => (t.plan?.goals.length ? planText(t.plan, f) : "") },
    { at: 850, render: (t, f) => f.section(m.taskSection, "task", t.tasks) },
  ],
  docs: {
    today: [{ at: 250, text: m.docs.today }],
    open: [{ at: 150, text: "|task|goal" }],
    find: [
      { at: 150, text: "|task" },
      { at: 350, text: "|goal|goal_log" },
      { at: 450, text: "task; " },
    ],
    get: [
      { at: 150, text: "tasks|" },
      { at: 350, text: "tasks," },
    ],
    save: [{ at: 250, text: m.docs.save }],
  },
  tools: [{
    name: "plan",
    description: m.docs.planTool,
    input: { date: z.string().optional(), from: z.string().optional(), to: z.string().optional() },
    run: (ctx, { date, from, to }: { date?: string; from?: string; to?: string }, f) => {
      const cal = ctx.mod("calendar")!;
      return from && to ? calendarText(cal.calendar(from, to), f) : planText(cal.plan(date), f);
    },
  }],
};
