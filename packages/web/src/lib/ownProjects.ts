// Own projects screen: journey, interest text, shelf split, focus
import { useEffect } from "react";
import { run } from "../api/actions";
import type { OwnProject, OwnStage, Sellable } from "../api/types";
import { ago, daysFrom, ratePct } from "./format";
import { useSettings } from "./settings";

/** Journey steps in order; the bar of a step is done before the project's stage, current at it, hatched after it */
export const JOURNEY: { key: OwnStage; label: string }[] = [
  { key: "fikir", label: "Fikir" },
  { key: "dogrulama", label: "Doğrulama" },
  { key: "demo", label: "Demo" },
  { key: "urun", label: "Ürün" },
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
  run("patch", `/own-projects/${p.id}`, { stage }, { ok: `Aşama: ${stageLabel(stage)}` }).catch(() => {});

/** Projects on the shelf (left and finished) are not worked on */
export const SHELF_STATUSES: string[] = ["birakildi", "tamamlandi"];
export const onShelf = (p: OwnProject) => SHELF_STATUSES.includes(p.status);

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

type Interest = Pick<OwnProject, "told" | "interested" | "interest_share">;
export const rateText = (p: Interest) => (p.interest_share === null ? "–" : `%${ratePct(p.interest_share)}`);
export const rateNote = (p: Interest) => (p.told ? `${p.told} kişiye anlattın, ${p.interested} ilgilendi` : "Henüz kimseye anlatılmadı");

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
  return d >= 0 ? "bugün güncellendi" : d === -1 ? "dün" : ago(iso);
}
