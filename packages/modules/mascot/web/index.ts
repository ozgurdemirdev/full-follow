// The mascot module's web part: a floating jellyfish (slot "app.overlay", it opens the chat when clicked) and its Settings category.
import { defineWebModule } from "@kit/app/modules/define";
import { MascotHost } from "./Host";
import { mascotRows } from "./settings";

/** Nav icon of the "Maskot" settings category */
const MASCOT_ICON = "M12 4c4 0 7 3 7 7v5l-2-1-2 2-3-2-3 2-2-2-2 1v-5c0-4 3-7 7-7zM9.5 10h.01M14.5 10h.01";

export default defineWebModule({
  key: "mascot",
  label: "Maskot",
  settingsCategories: [{ slug: "maskot", name: "Maskot", icon: MASCOT_ICON, order: 50 }],
  settings: [{ id: "mascot", category: "maskot", order: 10, rows: mascotRows }],
  slots: { "app.overlay": MascotHost },
});
