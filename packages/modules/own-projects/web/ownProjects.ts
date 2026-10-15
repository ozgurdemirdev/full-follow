// Own projects screen: journey, interest text, shelf split, focus
import { useEffect } from "react";
import { run } from "@kit/api/actions";
import type { OwnProject, OwnStage, Sellable } from "@kit/api/types";
import { ago, daysFrom, ratePct } from "@kit/lib/format";
import { useSettings } from "@kit/lib/settings";
import { m } from "./messages";

/** Journey steps in order; the bar of a step is done before the project's stage, current at it, hatched after it */
export const JOURNEY: { key: OwnStage; label: string }[] = [
  { key: "fikir", label: m.stages.fikir },
  { key: "dogrulama", label: m.stages.dogrulama },
  { key: "demo", label: m.stages.demo },
  { key: "urun", label: m.stages.urun },
];
export const stageLabel = (s: OwnStage) => JOURNEY.find((j) => j.key === s)?.label ?? s;
export type JourneyState = "done" | "now" | "next";
/** A project without a stage has every step still ahead of it */
export const journeyState = (at: OwnStage | null, step: OwnStage): JourneyState => {
  const a = JOURNEY.findIndex((j) => j.key === at);
  const k = JOURNEY.findIndex((j) => j.key === step);
  return k < a ? "done" : k === a ? "now" : "next";
};

/** A click on a journey step sets the project's stage */
export const setStage = (p: Pick<OwnProject, "id">, stage: OwnStage) =>
  run("patch", `/own-projects/${p.id}`, { stage }, { ok: m.stage(stageLabel(stage)) }).catch(() => {});

/** Projects on the shelf (left and finished) are not worked on */
export const SHELF_STATUSES: string[] = ["birakildi", "tamamlandi"];
export const onShelf = (p: OwnProject) => SHELF_STATUSES.includes(p.status);

/** Status dot colour (token classes) */
export const STATUS_DOT: Record<string, string> = {
  aktif: "bg-success", beklemede: "bg-warning", tamamlandi: "bg-info", birakildi: "bg-text-disabled",
};
/** Chip colours of the sellability (board values, reused chip tokens) */
export const SELLABLE_CLS: Record<Sellable, string> = {
  evet: "bg-chip-success-bg text-chip-success-fg",
  belki: "bg-chip-ask-bg text-chip-ask-fg",
  hayir: "bg-chip-neutral-bg text-chip-neutral-fg",
};

type Interest = Pick<OwnProject, "told" | "interested" | "interest_share">;
export const rateText = (p: Interest) => (p.interest_share === null ? "–" : `%${ratePct(p.interest_share)}`);
export const rateNote = (p: Interest) => (p.told ? m.rateNote(p.told, p.interested) : m.notTold);

/** The id the old build kept in this browser as the focus */
const LEGACY_FOCUS_KEY = "ff.ownFocus";
const legacyFocus = (): number | null => {
  try {
    return Number(localStorage.getItem(LEGACY_FOCUS_KEY)) || null;
  } catch {
    return null;
  }
};

/**
 * The focused project: the `focus_own_project_id` setting. A focus an earlier build kept in this browser moves into the setting once
 * (when the setting is still empty) and the old key is deleted.
 */
export function useFocusId() {
  const s = useSettings();
  const loaded = !!s.data;
  const stored = s.data?.focus_own_project_id ?? null;
  useEffect(() => {
    if (!loaded) return;
    const old = legacyFocus();
    try {
      localStorage.removeItem(LEGACY_FOCUS_KEY);
    } catch {
      /* storage blocked: nothing to delete */
    }
    if (old && stored === null) run("put", "/settings", { focus_own_project_id: old }, { silent: true }).catch(() => {});
  }, [loaded, stored]);
  const set = (id: number) => run("put", "/settings", { focus_own_project_id: id }, { silent: true }).catch(() => {});
  return { id: stored, set, loading: !loaded };
}

/** "bugün güncellendi", "dün", "5 gün önce" */
export function updatedText(iso: string): string {
  const d = daysFrom(iso);
  return d >= 0 ? m.updatedToday : d === -1 ? m.yesterday : ago(iso);
}
