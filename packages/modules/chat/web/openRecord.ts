import { useCallback } from "react";
import { useLocation } from "wouter";
import { currentRegistry } from "@kit/app/modules/registry";
import { PATHS } from "@kit/app/routes";
import { openSheet } from "@kit/app/ui";
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

/** Open a record in the panel: its page with a flash, or (a type with no page of its own) the dashboard with its edit form */
export function useOpenRecord() {
  const [, navigate] = useLocation();
  return useCallback((type: string, id: number) => {
    const registry = currentRegistry();
    const path = registry.link(type, id);
    if (!path) {
      const preset = registry.quickByKind.get(type)?.form.editPreset?.(id);
      if (!preset) return;
      navigate(PATHS.today);
      openSheet(type, preset);
      return;
    }
    navigate(path);
    flashRecord(type, id);
  }, [navigate]);
}
