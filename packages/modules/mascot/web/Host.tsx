import { lazy, useEffect } from "react";
import { setChatOpener } from "@kit/lib/chatStore";
import { useMascotLive, useMascotPrefs } from "./mascotStore";

// three.js and the scene load only when the mascot is drawn
const Mascot = lazy(() => import("./Mascot"));

/**
 * The mascot over the panel (slot "app.overlay"). While it is shown and its engine is ready it tells the chat so (the chat's own button steps aside:
 * there is always one way to open the chat), and it clears that when it goes away (hidden in Settings, switched off, unmounted).
 */
export function MascotHost({ onActivate }: { onActivate: () => void }) {
  const prefs = useMascotPrefs();
  const live = useMascotLive();
  const usable = prefs.show && live.engine === "ready";
  useEffect(() => {
    setChatOpener(usable);
    return () => setChatOpener(false);
  }, [usable]);
  return <Mascot onActivate={onActivate} />;
}
