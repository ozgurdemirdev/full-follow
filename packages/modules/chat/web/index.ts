// The chat module's web part: the panel chat window (slot "app.overlay", drawn over every page while the module is installed and visible)
// and its rows in the "Claude" settings category (pinned notes, auto drafts, what the chat may do without asking). The mascot reaches the window through the kit's lib/chatStore (open request, live state).
import { lazy } from "react";
import { defineWebModule } from "@kit/app/modules/define";
import { m } from "./messages";
import { accessRows } from "./accessSettings";
import { autoDraftRows, chatNotesRows } from "./settings";

/** Before the mascot (default order 100): the window is drawn first, as it was when the shell rendered it itself */
const OVERLAY_ORDER = 50;

export default defineWebModule({
  key: "chat",
  label: m.title,
  settings: [
    { id: "auto-draft", category: "claude", order: 25, rows: autoDraftRows },
    { id: "chat-notes", category: "claude", order: 30, rows: chatNotesRows },
    { id: "chat-access", category: "claude", order: 35, rows: accessRows },
  ],
  slots: { "app.overlay": { order: OVERLAY_ORDER, Component: lazy(() => import("./ChatWidget")) } },
});
