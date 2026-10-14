import { z } from "zod";
import type { McpDef, McpFormat } from "@fullfollow/core";
import { WEEKDAY_SHORT } from "./service/constants";

type Row = Record<string, any>;

const dayNames = (days: string) =>
  days === "1,2,3,4,5,6,7" ? "her gün" : days === "1,2,3,4,5" ? "hafta içi" : days.split(",").map((n) => WEEKDAY_SHORT[Number(n) - 1]).join(" ");

/** Auto count of a goal: `(otomatik 8)` for a channel, `(12 eklendi, 3 mükerrer atlandı)` for new records */
const autoText = (g: Row) =>
  g.metric === "new_records" ? (g.auto || g.duplicates ? ` (${g.auto} eklendi${g.duplicates ? `, ${g.duplicates} mükerrer atlandı` : ""})` : "") : g.auto ? ` (otomatik ${g.auto})` : "";

/** Günün planı: hedefler (yapılan/hedef), o günün görevleri, seri ve haftalık oran */
function planText(p: any, f: McpFormat): string {
  const goals = p.goals.map((g: Row) => `  #${g.id} ${g.title} ${g.done}/${g.target}${g.complete ? " ✓" : ""}${autoText(g)}${g.note ? ` · not: ${f.cut(g.note, 50)}` : ""}`);
  const tasks = p.tasks.map((t: Row) => "  " + f.line("task", t));
  const head = f.join(`PLAN ${p.date}`, p.streak ? `seri ${p.streak} gün` : "", p.week_ratio !== null && p.week_ratio !== undefined && `hafta %${Math.round(p.week_ratio * 100)}`);
  return [head, goals.length ? `Hedef:\n${goals.join("\n")}` : "hedef yok (save goal ile ekle)", tasks.length ? `Görev:\n${tasks.join("\n")}` : ""].filter(Boolean).join("\n");
}

/** Takvim: gün başına bir satır, altında o günün görevleri (id ile, panel sohbeti kart yapabilsin) */
function calendarText(days: Row[], f: McpFormat): string {
  return days.map((c) => [
    f.join(`${f.d(c.date)} ${WEEKDAY_SHORT[(new Date(`${c.date}T12:00:00Z`).getUTCDay() + 6) % 7]}`,
      c.ratio === null ? "hedef yok" : `hedef %${Math.round(c.ratio * 100)}`, c.tasks.length && `görev ${c.tasks.filter((t: Row) => t.done_at).length}/${c.tasks.length}`),
    ...c.tasks.map((t: Row) => "  " + f.line("task", t)),
  ].join("\n")).join("\n");
}

/** How the calendar's records and tool read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    task: {
      kind: "görev",
      openable: true,
      line: (r, f) => f.join(`#${r.id} [${f.who(r.assignee)}] ${r.title}`, r.due_date && `son ${f.d(r.due_date)}${r.due_time ? ` ${r.due_time}` : ""}`, r.kind !== "gorev" && r.kind, r.done_at && "bitti", r.person_name || r.company_name || r.opportunity_title || r.project_name),
    },
    goal: {
      kind: "hedef",
      openable: true,
      line: (r, f) => f.join(`#${r.id} ${r.title}`, `günde ${r.target}`, dayNames(r.days), r.channel && `otomatik: ${f.label(r.channel)}`, r.metric && `otomatik: ${f.label(r.metric)}`, r.today && `bugün ${r.today.done}/${r.today.target}`, r.note && `not: ${f.cut(r.note, 40)}`),
    },
    goal_log: {
      kind: "ilerleme",
      line: (r, f) => f.join(`#${r.id} ${r.goal_title} ${f.d(r.date)}`, `elle ${r.count}`, r.note && `not: ${f.cut(r.note, 50)}`),
    },
  },
  relations: { tasks: "task" },
  today: [
    { at: 0, render: (t, f) => (t.plan?.goals.length ? planText(t.plan, f) : "") },
    { at: 850, render: (t, f) => f.section("Görev", "task", t.tasks) },
  ],
  docs: {
    today: [{ at: 250, text: "görevler, " }],
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
    save: [{
      at: 250,
      text: "task: {title,assignee:ozgur|claude|musteri (musteri: müşterinin yapacağı iş, projede Müşteride bekliyor sayılır),due_date,due_time:'14:30',kind:gorusme|takip|gorev (varsayılan gorev)}. goal: {title,target,days,channel?|metric?:'new_records',note?} (günlük tekrarlı hedef); goal_log: {goal,add|count,date?,note?}.",
    }],
  },
  tools: [{
    name: "plan",
    description: "Günün iş planı: hedefler (yapılan/hedef; kanallı hedefte giden mesajlar kendiliğinden sayılır), o günün görevleri, seri, haftalık tutturma oranı. date varsayılan bugün. from+to verilirse takvim (gün gün hedef doluluğu ve görevler, en fazla 92 gün). Hedef: save goal {title,target,days:'her_gun|hafta_ici|hafta_sonu'|[1..7],channel?|metric?,note?}; channel verilirse o kanaldaki giden mesajlar, metric:'new_records' verilirse o gün eklenen yeni kişi ve firmalar kendiliğinden sayılır (çıktıda eklenen ve mükerrer atlanan sayısı görünür; kanal ve metric birlikte verilmez, örn. Perşembe liste yenileme {title:'Liste yenileme',target:50,days:[4],metric:'new_records'}); ilerleme: save goal_log {goal:'ad',add:1|count:10,date?,note?}.",
    input: { date: z.string().optional(), from: z.string().optional(), to: z.string().optional() },
    run: (ctx, { date, from, to }: { date?: string; from?: string; to?: string }, f) => {
      const cal = ctx.mod("calendar")!;
      return from && to ? calendarText(cal.calendar(from, to), f) : planText(cal.plan(date), f);
    },
  }],
};
