import * as mo from "motion/react-m";
import { useState } from "react";
import type { Draft, Person } from "@kit/api/types";
import { toast } from "@kit/components/toast";
import { dur, ease } from "@kit/lib/motion";
import { CHANNEL } from "@kit/lib/labels";
import { channelIcon, companyOf, copyTextOf, draftKind, firstName, handleOf, STACK, SUBJECT_CHANNEL, wordsLabel, type DraftResult } from "../drafts";
import { BoardIcon } from "@kit/components/boardIcons";
import { Avatar } from "@kit/components/ui";
import { m } from "../messages";
import { RejectPanel } from "./RejectPanel";
import { useDraftEdit } from "./useDraftEdit";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** The top card flies out right on approve and left on reject; reduced motion keeps only the fade */
const VARIANTS = {
  enter: { opacity: 0, y: STACK.enterY, scale: STACK.enterScale },
  show: { opacity: 1, y: 0, scale: 1, x: 0, rotate: 0, transition: { duration: dur["drafts-enter"], ease: ease.out } },
  leave: (dir: DraftResult) => {
    const sign = dir === "sent" ? 1 : -1;
    return {
      opacity: 0,
      x: `${sign * STACK.leaveX}%`,
      rotate: sign * STACK.leaveRotate,
      transition: { x: { duration: dur["drafts-leave"], ease: ease.leave }, rotate: { duration: dur["drafts-leave"], ease: ease.leave }, opacity: { duration: dur["drafts-leave-fade"], ease: ease.leave } },
    };
  },
};

/** The draft on top of the stack: recipient, subject, text with the edit, copy, reject and approve actions */
export function DraftCard({ d, person, onResult }: { d: Draft; person?: Person; onResult: (r: DraftResult) => void }) {
  const first = firstName(d.to_name);
  const { editing, setEditing, text, setText, subject, setSubject, busy, save, send, reject } = useDraftEdit(d, m.review.sentOk(first));
  const [rejecting, setRejecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const handle = handleOf(d, person);

  const approve = async () => {
    if (await send()) onResult("sent");
  };
  const confirmReject = async (note: string) => {
    if (await reject(note, m.review.rejectedOk)) onResult("rejected");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyTextOf(subject, text));
      setCopied(true);
      toast(m.review.copied);
    } catch {
      toast(m.review.copyFailed, "error");
    }
  };

  return (
    <mo.article data-record={`draft-${d.id}`} className="drf-top" aria-label={m.review.forDraft(d.to_name)} variants={VARIANTS} initial="enter" animate="show" exit="leave">
      <div className="drf-who">
        <Avatar name={d.to_name} id={d.person_id ?? undefined} size="tile" />
        <span className="drf-who-text">
          <span className="drf-to">{companyOf(d) ? `${d.to_name} · ${companyOf(d)}` : d.to_name}</span>
          <span className="drf-channel">
            <BoardIcon name={channelIcon(d.channel)} className="size-drafts-channel-icon" stroke={STROKE.thin} />
            {CHANNEL[d.channel] ?? d.channel}{handle ? ` · ${handle}` : ""}
          </span>
        </span>
        <span className="drf-kind">{draftKind(d)}</span>
      </div>
      {editing && d.channel === SUBJECT_CHANNEL ? (
        <label className="drf-subject is-edit">
          <span>{m.common.subject}</span>
          <input className="drf-subject-edit" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={m.review.emailSubject} />
        </label>
      ) : subject.trim() ? <div className="drf-subject"><span>{m.common.subject}</span><span>{subject}</span></div> : null}
      {editing ? (
        <textarea className="drf-edit" value={text} onChange={(e) => setText(e.target.value)} aria-label={m.card.editLabel} rows={8} autoFocus />
      ) : (
        <p className="drf-text">{text}</p>
      )}
      <div className="drf-meta">{wordsLabel(text)}</div>
      {rejecting ? (
        <RejectPanel busy={busy} onCancel={() => setRejecting(false)} onConfirm={(n) => void confirmReject(n)} />
      ) : (
        <div className="drf-actions">
          <button type="button" className="drf-act is-reject" disabled={busy} onClick={() => { setRejecting(true); setEditing(false); }}>{m.review.reject}</button>
          <button type="button" className="drf-act" disabled={busy} onClick={editing ? () => void save() : () => setEditing(true)}>{editing ? m.review.done : kit.edit}</button>
          <span className="flex-grow" />
          <button type="button" className="drf-act is-copy" onClick={() => void copy()}>{copied ? m.common.copied : m.common.copy}</button>
          <button type="button" className="drf-act is-approve" disabled={busy} onClick={() => void approve()}>
            {m.card.approve}
            <span className="drf-act-circle"><BoardIcon name="check" className="size-icon-xs" stroke={STROKE.bold} /></span>
          </button>
        </div>
      )}
    </mo.article>
  );
}
