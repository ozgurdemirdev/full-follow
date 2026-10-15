// The chat module's web part (the manifest). The chat widget itself is still rendered by the shell (packages/web/src/app/ChatWidget.tsx),
// which asks `visible("chat")`; this manifest gives the module its place in the Settings "Modüller" list. Moving the widget in comes next.
import { defineWebModule } from "@kit/app/modules/define";

export default defineWebModule({ key: "chat", label: "Sohbet" });
