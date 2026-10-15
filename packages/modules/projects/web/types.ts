// The projects module's own API types (the project task shapes of the calendar endpoint stay in the kit's api/types.ts)
import type { Project } from "@kit/api/types";

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
