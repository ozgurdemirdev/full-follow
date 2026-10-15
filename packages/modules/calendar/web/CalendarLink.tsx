import { Link } from "wouter";
import { BoardIcon } from "@kit/components/boardIcons";
import { CALENDAR_PATH } from "./paths";

/** The round calendar button in the dashboard header (slot "dashboard.tools") */
export function CalendarLink() {
  return (
    <Link href={CALENDAR_PATH} className="dash-round" aria-label="Takvim">
      <BoardIcon name="calendar" />
    </Link>
  );
}
