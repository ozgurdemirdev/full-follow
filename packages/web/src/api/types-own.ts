import type { OwnProject } from "./types";

/** Journey of an own project (Fikir, Doğrulama, Demo, Ürün). Gap G15: not served by the API yet */
export type OwnStage = "fikir" | "dogrulama" | "demo" | "urun";

/** An own project as the screen reads it: `stage` appears once core adds `own_projects.stage` */
export type OwnRow = OwnProject & { stage?: OwnStage | null };
