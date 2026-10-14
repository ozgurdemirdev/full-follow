import { Slot } from "../../app/modules/Slot";
import { GlobalSearch } from "../../app/Search";
import { QuickAddButton } from "../quick-add/QuickMenu";

/** Right side of the dashboard header: search, the buttons modules add (the calendar link), new record */
export function DashTools() {
  return (
    <div className="dash-tools">
      <GlobalSearch board />
      <Slot name="dashboard.tools" />
      <QuickAddButton />
    </div>
  );
}
