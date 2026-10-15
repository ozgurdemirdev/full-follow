// The calendar module's web part: the manifest the shell builds its route, nav item, dashboard card, forms and settings row from.
import { defineWebModule } from "@kit/app/modules/define";
import { FORM_ICON } from "@kit/components/forms/icons";
import { m as kit } from "@kit/messages";
import { CalendarLink } from "./CalendarLink";
import { GoalStrip } from "./cards/GoalMeters";
import { ProjectTasks } from "./cards/ProjectTasks";
import { RecordNextStep } from "./cards/RecordNextStep";
import { m } from "./messages";
import { CALENDAR_PATH } from "./paths";
import { dailyGoalsRows } from "./settings";

/** Data the plan screens read: a write to anything that moves a plan or a calendar day refreshes them */
const PLAN = ["/plan", "/calendar"];

export default defineWebModule({
  key: "calendar",
  label: m.label,
  routes: [{ page: "calendar", path: CALENDAR_PATH, load: () => import("./pages/Calendar") }],
  nav: [{ group: kit.navGroups.network, order: 20, label: m.label, icon: "calendar", path: CALENDAR_PATH }],
  dashboard: [
    { id: "plan", column: 0, order: 20, show: (t) => !!t.plan, load: () => import("./cards/PlanCard").then((mod) => ({ default: mod.PlanCard })) },
  ],
  settings: [{ id: "daily-goals", category: "isletme", order: 30, rows: dailyGoalsRows }],
  quickAdd: [
    {
      kind: "task", name: kit.nouns.task, key: "G", dest: m.quickAdd.taskDest, icon: FORM_ICON.task, tone: "accent", group: kit.quickGroups.plan, order: 10,
      form: {
        noun: kit.nouns.task, dest: m.quickAdd.taskFormDest, icon: FORM_ICON.task, base: "/tasks",
        editId: (p) => p.edit, editPreset: (id) => ({ edit: id }), page: () => CALENDAR_PATH,
      },
      load: () => import("./forms/TaskForm").then((mod) => ({ default: mod.TaskForm })),
    },
    {
      kind: "goal", name: kit.nouns.goal, key: "H", dest: m.quickAdd.goalDest, icon: FORM_ICON.target, tone: "accent", group: kit.quickGroups.plan, order: 20,
      form: {
        noun: kit.nouns.goal, dest: m.quickAdd.goalFormDest, icon: FORM_ICON.target, base: "/goals",
        editId: (p) => p.edit, editPreset: (id) => ({ edit: id }), page: () => CALENDAR_PATH,
      },
      load: () => import("./forms/GoalForm").then((mod) => ({ default: mod.GoalForm })),
    },
  ],
  slots: { "dashboard.strip": GoalStrip, "dashboard.tools": CalendarLink, "opportunity.side": RecordNextStep, "timeline.next-step": RecordNextStep, "project.detail.tasks": ProjectTasks },
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
