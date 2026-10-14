// Kabuk durumu (menü, çekmece, hızlı ekle formu): küçük dış depo, seçiciyle abonelik
import { useSyncExternalStore } from "react";
import type { OppStage } from "../lib/labels";

export type SheetKind = "opportunity" | "person" | "company" | "touch" | "task" | "comment" | "draft" | "post" | "idea" | "template" | "project" | "goal" | "own_project" | "offer";
export interface SheetState {
  kind: SheetKind;
  /** forma önceden doldurulacak değerler */
  preset?: {
    stage?: OppStage; person_id?: number; opportunity_id?: number; project_id?: number; target?: { type: string; id: number; label: string };
    /** Paket 2: düzenlenecek kayıt ya da ön seçim */
    post_id?: number; idea_id?: number; template_id?: number; channel?: string; own_project_id?: number;
    /** Paket 3: düzenlenecek kayıt (fırsat, görev, temas, firma), firma muhatap ve sadece adresli muhatap */
    edit?: number; date?: string; company_id?: number; contact?: string;
  };
}
interface UI {
  collapsed: boolean;
  sheet: SheetState | null;
}

const KEY = "ff.sidebar.collapsed";
let state: UI = {
  collapsed: (() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  })(),
  sheet: null,
};
const subs = new Set<() => void>();

export function setUI(patch: Partial<UI>) {
  state = { ...state, ...patch };
  if ("collapsed" in patch) {
    try {
      localStorage.setItem(KEY, state.collapsed ? "1" : "0");
    } catch {
      /* gizli pencere */
    }
  }
  subs.forEach((fn) => fn());
}

export function useUI<T>(select: (s: UI) => T): T {
  return useSyncExternalStore(
    (fn) => (subs.add(fn), () => void subs.delete(fn)),
    () => select(state),
  );
}

export const openSheet = (kind: SheetKind, preset?: SheetState["preset"]) => setUI({ sheet: { kind, preset } });
export const closeSheet = () => setUI({ sheet: null });
