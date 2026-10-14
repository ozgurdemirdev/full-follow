// Own projects screen: journey, derived next step and interest, shelf split, focus per browser
import { useState } from "react";
import type { Idea, OwnRow, OwnStage, Sellable } from "../api/types";
import { ago, daysFrom } from "./format";
import { PRIORITIES } from "./labels";

/** Journey steps in order; the bar of a step is done before the project's stage, current at it, hatched after it */
export const JOURNEY: { key: OwnStage; label: string }[] = [
  { key: "fikir", label: "Fikir" },
  { key: "dogrulama", label: "Doğrulama" },
  { key: "demo", label: "Demo" },
  { key: "urun", label: "Ürün" },
];
export const stageLabel = (s: OwnStage) => JOURNEY.find((j) => j.key === s)?.label ?? s;
export type JourneyState = "done" | "now" | "next";
export const journeyState = (at: OwnStage, step: OwnStage): JourneyState => {
  const a = JOURNEY.findIndex((j) => j.key === at);
  const k = JOURNEY.findIndex((j) => j.key === step);
  return k < a ? "done" : k === a ? "now" : "next";
};

/** Projects on the shelf (left and finished) are not worked on */
export const SHELF_STATUSES: string[] = ["birakildi", "tamamlandi"];
export const onShelf = (p: OwnRow) => SHELF_STATUSES.includes(p.status);

/** Status dot colour (token classes) */
export const STATUS_DOT: Record<string, string> = {
  aktif: "bg-success", beklemede: "bg-warning", tamamlandi: "bg-info", birakildi: "bg-text-disabled",
};
/** Chip colours of the sellability and the idea stage (board values, reused chip tokens) */
export const SELLABLE_CLS: Record<Sellable, string> = {
  evet: "bg-chip-success-bg text-chip-success-fg",
  belki: "bg-chip-ask-bg text-chip-ask-fg",
  hayir: "bg-chip-neutral-bg text-chip-neutral-fg",
};
export const IDEA_STAGE_CLS: Record<string, string> = {
  fikir: "bg-chip-neutral-bg text-chip-neutral-fg",
  dogrulaniyor: "bg-chip-ask-bg text-chip-ask-fg",
  demo: "bg-chip-opportunity-bg text-chip-opportunity-fg",
  urun: "bg-chip-success-bg text-chip-success-fg",
};
export const PRIORITY_DOT: Record<string, string> = { yuksek: "bg-danger", orta: "bg-warning", dusuk: "bg-text-muted" };

export interface OwnStats {
  /** open ideas, highest priority first, then by position */
  open: Idea[];
  done: number;
  told: number;
  interested: number;
  /** interested / told in percent, null when nobody was told */
  rate: number | null;
  /** next step: the top open high priority idea. Moves into core with the own-projects module (gap G15) */
  next?: Idea;
  /** open high priority ideas */
  top: Idea[];
}

const PERCENT = 100;

/** Stats of every project from one ideas list, one pass. Derived here until core serves them (gap G15) */
export function ownStats(ideas: Idea[]): Map<number, OwnStats> {
  const by = new Map<number, Idea[]>();
  for (const i of ideas) {
    if (!i.own_project_id) continue;
    const list = by.get(i.own_project_id);
    if (list) list.push(i);
    else by.set(i.own_project_id, [i]);
  }
  const out = new Map<number, OwnStats>();
  for (const [id, list] of by) {
    const open = list.filter((i) => !i.done_at).sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.position - b.position || a.id - b.id);
    const told = list.reduce((s, i) => s + i.told, 0);
    const interested = list.reduce((s, i) => s + i.interested, 0);
    const top = open.filter((i) => i.priority === "yuksek");
    out.set(id, { open, done: list.length - open.length, told, interested, rate: told ? Math.round((interested / told) * PERCENT) : null, next: top[0], top });
  }
  return out;
}

export const EMPTY_STATS: OwnStats = { open: [], done: 0, told: 0, interested: 0, rate: null, top: [] };
export const rateText = (s: OwnStats) => (s.rate === null ? "–" : `%${s.rate}`);
export const rateNote = (s: OwnStats) => (s.told ? `${s.told} kişiye anlattın, ${s.interested} ilgilendi` : "Henüz kimseye anlatılmadı");

const FOCUS_KEY = "ff.ownFocus";

/** The focused project: picked by the user, kept per browser until core has the `focus_own_project_id` setting (gap G15) */
export function useFocusId() {
  const [id, set] = useState<number | null>(() => {
    try {
      return Number(localStorage.getItem(FOCUS_KEY)) || null;
    } catch {
      return null;
    }
  });
  const setId = (next: number) => {
    set(next);
    try {
      localStorage.setItem(FOCUS_KEY, String(next));
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
  };
  return [id, setId] as const;
}

/** "bugün güncellendi", "dün", "5 gün önce" */
export function updatedText(iso: string): string {
  const d = daysFrom(iso);
  return d >= 0 ? "bugün güncellendi" : d === -1 ? "dün" : ago(iso);
}
