// Types of the client projects screen. Kept out of types.ts (at its line limit).
import type { Actor } from "../lib/labels";
import type { FileRow, Project, Task } from "./types";

/** Task owner: the two actors, plus the client once core adds "musteri" to the assignees (gap G14) */
export type TaskAssignee = Actor | "musteri";
export type ProjectTask = Omit<Task, "assignee"> & { assignee: TaskAssignee };

/** `GET /api/tasks/by-project` (calendar module): the tasks of one project; the name is null without the projects module */
export interface ProjectTaskGroup {
  project_id: number;
  project_name: string | null;
  tasks: ProjectTask[];
}

/** Who a project waits on: Özgür, the client, or overdue money or work */
export type WaitKey = "me" | "client" | "late";

/**
 * Fields core will add to a project row with the projects module (gap G14).
 * Until they arrive the web derives the same values from payments and tasks (lib/projects.ts, waitOf).
 */
export interface ProjectWaiting {
  /** who the project waits on; null when nothing waits */
  waiting?: "sende" | "musteride" | "gecikti" | null;
  /** money held by that wait, whole TL */
  waiting_amount?: number;
  /** uploaded files of the project, newest first (core can store them, no endpoint lists them yet) */
  files?: FileRow[];
}
export type ProjectRow = Project & ProjectWaiting;
