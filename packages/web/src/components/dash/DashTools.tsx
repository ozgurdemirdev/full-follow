import { Link } from "wouter";
import { useModules } from "../../api/modules";
import { PATHS } from "../../app/routes";
import { GlobalSearch } from "../../app/Search";
import { BoardIcon } from "../boardIcons";
import { QuickAddButton } from "../quick-add/QuickMenu";

/** Right side of the dashboard header: search, calendar, new record */
export function DashTools() {
  const { has } = useModules();
  return (
    <div className="dash-tools">
      <GlobalSearch board />
      {has("calendar") ? (
        <Link href={PATHS.calendar} className="dash-round" aria-label="Takvim">
          <BoardIcon name="calendar" />
        </Link>
      ) : null}
      <QuickAddButton />
    </div>
  );
}
