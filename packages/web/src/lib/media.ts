import { useSyncExternalStore } from "react";
import { layout } from "../styles/tokens.json";

const query = `(min-width: ${parseInt(layout["breakpoint-mobile"], 10) + 1}px)`;
const mql = typeof window !== "undefined" ? window.matchMedia(query) : null;

/** Masaüstü genişliği mi (tokens.json'daki mobil sınırına göre) */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (fn) => (mql?.addEventListener("change", fn), () => mql?.removeEventListener("change", fn)),
    () => mql?.matches ?? true,
  );
}

/** Desktop layout (the `desk:` breakpoint from the tokens), read now */
export const isDesk = () => window.matchMedia(`(min-width: ${getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-desk")})`).matches;
