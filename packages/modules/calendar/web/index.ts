// The calendar module's web part: the manifest the shell builds its route, nav item, dashboard card, forms and settings row from.
import { defineWebModule } from "@kit/app/modules/define";
import { FORM_ICON } from "@kit/components/forms/icons";
import { CalendarLink } from "./CalendarLink";
import { GoalStrip } from "./cards/GoalMeters";
import { ProjectTasks } from "./cards/ProjectTasks";
import { CALENDAR_PATH } from "./paths";
import { dailyGoalsRows } from "./settings";

/** Data the plan screens read: a write to anything that moves a plan or a calendar day refreshes them */
const PLAN = ["/plan", "/calendar"];

export default defineWebModule({
  key: "calendar",
  label: "Takvim",
  routes: [{ page: "calendar", path: CALENDAR_PATH, load: () => import("./pages/Calendar") }],
  nav: [{ group: "Network", order: 20, label: "Takvim", icon: "calendar", path: CALENDAR_PATH }],
  dashboard: [
    { id: "plan", column: 0, order: 20, show: (t) => !!t.plan, load: () => import("./cards/PlanCard").then((m) => ({ default: m.PlanCard })) },
  ],
  settings: [{ id: "daily-goals", category: "isletme", order: 30, rows: dailyGoalsRows }],
  quickAdd: [
    {
      kind: "task", name: "Görev", key: "G", dest: "Takvim ve bugünün planı", icon: FORM_ICON.task, tone: "accent", group: "Plan", order: 10,
      form: {
        noun: "Görev", dest: "Takvime ve Bugünün planına düşer", icon: FORM_ICON.task, base: "/tasks",
        editId: (p) => p.edit, editPreset: (id) => ({ edit: id }), page: () => CALENDAR_PATH,
      },
      load: () => import("./forms/TaskForm").then((m) => ({ default: m.TaskForm })),
    },
    {
      kind: "goal", name: "Hedef", key: "H", dest: "Günlük hedefler", icon: FORM_ICON.target, tone: "accent", group: "Plan", order: 20,
      form: {
        noun: "Hedef", dest: "Günlük hedeflere eklenir", icon: FORM_ICON.target, base: "/goals",
        editId: (p) => p.edit, editPreset: (id) => ({ edit: id }), page: () => CALENDAR_PATH,
      },
      load: () => import("./forms/GoalForm").then((m) => ({ default: m.GoalForm })),
    },
  ],
  slots: { "dashboard.strip": GoalStrip, "dashboard.tools": CalendarLink, "project.detail.tasks": ProjectTasks },
  invalidates: {
    tasks: ["/tasks", "/today", "/projects", "/timeline", "/trash", ...PLAN],
    goals: ["/goals", "/today", "/timeline", "/trash", ...PLAN],
    people: PLAN,
    companies: PLAN,
    opportunities: PLAN,
    payments: PLAN,
    touches: PLAN,
  },
});
