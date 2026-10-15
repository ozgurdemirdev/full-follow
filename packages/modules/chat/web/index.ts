// The chat module's web part: the panel chat window (slot "app.overlay", drawn over every page while the module is installed and visible)
// and its row in the "Claude" settings category. The mascot reaches the window through the kit's lib/chatStore (open request, live state).
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { chatNotesRows } from "./settings";

/** Before the mascot (default order 100): the window is drawn first, as it was when the shell rendered it itself */
const OVERLAY_ORDER = 50;

export default defineWebModule({
  key: "chat",
  label: "Sohbet",
  settings: [{ id: "chat-notes", category: "claude", order: 30, rows: chatNotesRows }],
  slots: { "app.overlay": { order: OVERLAY_ORDER, Component: lazy(() => import("./ChatWidget")) } },
});
