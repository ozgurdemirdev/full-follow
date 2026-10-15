import { Link } from "wouter";
import { BoardIcon } from "@kit/components/boardIcons";
import { m } from "./messages";
import { CALENDAR_PATH } from "./paths";

/** The round calendar button in the dashboard header (slot "dashboard.tools") */
export function CalendarLink() {
  return (
    <Link href={CALENDAR_PATH} className="dash-round" aria-label={m.label}>
      <BoardIcon name="calendar" />
    </Link>
  );
}
