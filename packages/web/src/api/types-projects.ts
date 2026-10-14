// Types of the client projects screen. Kept out of types.ts (at its line limit).
import type { Actor } from "../lib/labels";
import type { Project, Task } from "./types";

/** Task owner: the two actors, plus the client (musteri) */
export type TaskAssignee = Actor | "musteri";
export type ProjectTask = Omit<Task, "assignee"> & { assignee: TaskAssignee };

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
