import type { Ref } from "react";
import { T } from "../chatText";
import { Icon } from "@kit/components/icons";

interface Props {
  open: boolean;
  /** status text of the running reply, shown while the window is minimized */
  status: string | null;
  seconds: number;
  ready: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onToggle: () => void;
}

/** Sits above the + FAB; grows into a status pill while a reply runs and the window is minimized */
export function ChatButton({ open, status, seconds, ready, buttonRef, onToggle }: Props) {
  const running = !open && status !== null;
  const pill = running || (!open && ready);
  return (
    <button
      ref={buttonRef}
      className="cb"
      type="button"
      aria-label={T.title}
      aria-expanded={open}
      aria-controls="chat-window"
      data-running={running ? "" : undefined}
      data-pill={pill ? "" : undefined}
      data-ready={!open && ready ? "" : undefined}
      onClick={onToggle}
    >
      <span className="cb-ic">
        <span className="cb-ring" />
        <Icon name="chat" className="size-icon-xl" />
        <Icon name="spark" className="cb-spark size-icon-xl" />
      </span>
      <span className="cb-label">
        <b>{running ? status : ready ? T.pillReady : ""}</b>
        {running && <i className="mono">{T.seconds(seconds)}</i>}
      </span>
      <span className="cb-badge" />
    </button>
  );
}
