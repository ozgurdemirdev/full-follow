import { memo, useState } from "react";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { toast } from "@kit/components/toast";
import { stroke as STROKE } from "@kit/styles/tokens.json";
import type { ChatPermission, PermissionState } from "../api";
import { SECOND_MS } from "../constants";
import { T } from "../messages";
import { useElapsed } from "./StatusLine";

/** Line icons of what a confirmation is about (24 unit grid, the board's stroke): a bin, a wallet, the settings gear, a pen on a file */
const TRASH = "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3";
const WALLET = "M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14h1";
const icon = (tool: string) => (/__delete$/.test(tool) ? TRASH : /__pay$/.test(tool) ? WALLET : /__save$/.test(tool) ? BOARD_ICON.settings : BOARD_ICON.pen);

const OUTCOME: Record<Exclude<PermissionState, "pending">, string> = {
  allowed: T.permission.allowed, denied: T.permission.denied, expired: T.permission.expired, cancelled: T.permission.cancelled,
};

/** Seconds left before the host refuses it on its own; shown so the owner knows the card will not wait for ever */
function Countdown({ since, timeoutMs }: { since: number; timeoutMs: number }) {
  const left = Math.max(0, Math.ceil(timeoutMs / SECOND_MS) - useElapsed(since));
  return <span className="perm-time mono" aria-label={T.permission.leftLabel(left)}>{T.permission.left(left)}</span>;
}

/**
 * A confirmation Claude asked for, under the reply it belongs to: what will happen, "Onayla" and "Vazgeç" while the reply waits for
 * it, then the outcome. A pending card whose reply already ended can no longer be answered and reads as cancelled.
 */
export const PermissionCard = memo(function PermissionCard({ card, active, timeoutMs, onAnswer }: {
  card: ChatPermission;
  /** the reply it belongs to is still running, so an answer still counts */
  active: boolean;
  timeoutMs: number;
  onAnswer: (id: number, allow: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const open = card.state === "pending" && active;
  const state: Exclude<PermissionState, "pending"> = card.state === "pending" ? "cancelled" : card.state;
  const answer = async (allow: boolean) => {
    setBusy(true);
    try {
      await onAnswer(card.id, allow);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="perm" role="group" aria-label={T.permission.region} data-state={open ? "pending" : state}>
      <div className="perm-head">
        <svg className="size-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE.icon} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={icon(card.tool_name)} />
        </svg>
        <span className="perm-label">{open ? T.permission.label : T.permission.wants}</span>
        {open && <Countdown since={Date.parse(card.created_at)} timeoutMs={timeoutMs} />}
      </div>
      <p className="perm-what">{card.summary}</p>
      {open ? (
        <div className="perm-acts">
          <button type="button" className="perm-btn" disabled={busy} onClick={() => void answer(false)}>{T.permission.deny}</button>
          <button type="button" className="perm-btn is-primary" disabled={busy} onClick={() => void answer(true)}>{T.permission.allow}</button>
        </div>
      ) : (
        <span className="perm-out" data-tone={state === "allowed" ? "ok" : state === "denied" ? "no" : "muted"}>{OUTCOME[state]}</span>
      )}
    </section>
  );
});
