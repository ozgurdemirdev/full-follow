import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { QuickMenuItems } from "../../app/Fab";
import { PATHS } from "../../app/routes";
import { GlobalSearch } from "../../app/Search";
import { openSheet } from "../../app/ui";
import { BoardIcon } from "../boardIcons";

/** "Yeni kayıt" button with the quick add menu (the same items as the floating button) */
function NewRecord() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);

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
