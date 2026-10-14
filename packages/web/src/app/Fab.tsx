import { QuickAddFab, useQuickShortcut } from "../components/quick-add/QuickMenu";

/** Quick add outside the page headers: the floating button (phones, and desktop pages without the header button) and the N shortcut */
export function Fab() {
  useQuickShortcut();
  return <QuickAddFab />;
}
