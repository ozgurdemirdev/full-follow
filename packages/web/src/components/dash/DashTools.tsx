import { Link } from "wouter";
import { QuickMenuItems } from "../../app/Fab";
import { PATHS } from "../../app/routes";
import { GlobalSearch } from "../../app/Search";
import { openSheet } from "../../app/ui";
import { usePopover } from "../../lib/usePopover";
import { BoardIcon } from "../boardIcons";

/** "Yeni kayıt" button with the quick add menu (the same items as the floating button) */
function NewRecord() {
  const { open, setOpen, root } = usePopover();

  return (
    <div ref={root} className="relative">
      <button type="button" className="dash-new" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="plus" className="size-icon-btn" stroke={2} />
        Yeni kayıt
      </button>
      <div role="menu" aria-label="Yeni kayıt" aria-hidden={!open} className="dash-menu">
        <QuickMenuItems
          open={open}
          onPick={(kind) => {
            setOpen(false);
            openSheet(kind);
          }}
        />
      </div>
    </div>
  );
}

/** Right side of the dashboard header: search, calendar, new record */
export function DashTools() {
  return (
    <div className="dash-tools">
      <GlobalSearch board />
      <Link href={PATHS.calendar} className="dash-round" aria-label="Takvim">
        <BoardIcon name="calendar" />
      </Link>
      <NewRecord />
    </div>
  );
}
