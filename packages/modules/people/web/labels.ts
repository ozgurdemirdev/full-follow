import { m } from "./messages";

/** A person's part in a buying decision */
export type Influence = "karar_verici" | "etkileyici" | "kullanici";
export const INFLUENCE_LABEL: Record<Influence, string> = m.influence;
export const INFLUENCE_TONE: Record<Influence, "payment" | "opportunity" | "neutral"> = { karar_verici: "payment", etkileyici: "opportunity", kullanici: "neutral" };
