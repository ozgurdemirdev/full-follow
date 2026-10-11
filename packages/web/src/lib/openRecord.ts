import { useCallback } from "react";
import { useLocation } from "wouter";
import { PATHS, recordPath } from "../app/routes";
import { openSheet, type SheetKind } from "../app/ui";
import { CHAT_UI } from "./chatText";

const ms = (v: string) => parseFloat(v);

/** After navigating: wait for the row (the page loads lazily), centre it and flash it with the primary tint */
export function flashRecord(type: string, id: number) {
  const sel = `[data-record="${type}-${id}"]`;
  const hold = ms(getComputedStyle(document.documentElement).getPropertyValue("--dur-bar-grow"));
  let tries = 0;
  const look = () => {
    const el = document.querySelector(sel);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.setAttribute("data-flash", "");
      setTimeout(() => el.removeAttribute("data-flash"), hold);
    } else if (++tries < CHAT_UI.flashTries) {
      setTimeout(look, CHAT_UI.flashPollMs);
    }
  };
  look();
}

/** Open a record in the panel: its page with a flash, or the dashboard with its edit form for tasks and goals */
export function useOpenRecord() {
  const [, navigate] = useLocation();
  return useCallback((type: string, id: number) => {
    if (type === "task" || type === "goal") {
      navigate(PATHS.today);
      openSheet(type as SheetKind, { edit: id });
      return;
    }
    const path = recordPath(type, id);
    if (!path) return;
    navigate(path);
    flashRecord(type, id);
  }, [navigate]);
}

/** Desktop layout (the `desk:` breakpoint from the tokens) */
export const isDesk = () => window.matchMedia(`(min-width: ${getComputedStyle(document.documentElement).getPropertyValue("--breakpoint-desk")})`).matches;
