// Types of the client projects screen. Kept out of types.ts (at its line limit).
import type { TaskAssignee } from "../lib/labels";
import type { Project, Task } from "./types";

/** Task owner: the two actors, plus the client (musteri) */
export type { TaskAssignee };
export type ProjectTask = Omit<Task, "assignee"> & { assignee: TaskAssignee };

/** `GET /api/tasks/by-project` (calendar module): the tasks of one project; the name is null without the projects module */
export interface ProjectTaskGroup {
  project_id: number;
  project_name: string | null;
  tasks: ProjectTask[];
}

/** Who a project waits on: Özgür, the client, or overdue money or work */
export type WaitKey = "me" | "client" | "late";

/** Fields the projects module adds to a project row */
export interface ProjectWaiting {
  /** who the project waits on; null when nothing waits */
  waiting: "sende" | "musteride" | "gecikti" | null;
  /** money held by that wait, whole TL */
  waiting_amount: number;
}
export type ProjectRow = Project & ProjectWaiting;
