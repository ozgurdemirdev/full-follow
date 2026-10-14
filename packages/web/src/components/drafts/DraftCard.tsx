import * as m from "motion/react-m";
import { useState } from "react";
import type { Draft, Person } from "../../api/types";
import { toast } from "../../components/toast";
import { dur, ease } from "../../lib/motion";
import { CHANNEL } from "../../lib/labels";
import { channelIcon, draftKind, firstName, handleOf, STACK, wordsLabel, type DraftResult } from "../../lib/drafts";
import { BoardIcon } from "../boardIcons";
import { Avatar } from "../ui";
import { RejectPanel } from "./RejectPanel";
import { useDraftEdit } from "./useDraftEdit";

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
  const { editing, setEditing, text, setText, busy, save, send, reject } = useDraftEdit(d, `Gönderildi, ${first} için temas kaydedildi`);
  const [rejecting, setRejecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const handle = handleOf(d, person);
  const company = person?.company_name;

  const approve = async () => {
    if (await send()) onResult("sent");
  };
  const confirmReject = async (note: string) => {
    if (await reject(note, "Reddedildi, Claude bunu öğrendi")) onResult("rejected");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Metin kopyalandı");
    } catch {
      toast("Kopyalanamadı", "error");
    }
  };

  return (
    <m.article data-record={`draft-${d.id}`} className="drf-top" aria-label={`${d.to_name} için taslak`} variants={VARIANTS} initial="enter" animate="show" exit="leave">
      <div className="drf-who">
        <Avatar name={d.to_name} id={d.person_id ?? undefined} size="tile" />
        <span className="drf-who-text">
          <span className="drf-to">{company ? `${d.to_name} · ${company}` : d.to_name}</span>
          <span className="drf-channel">
            <BoardIcon name={channelIcon(d.channel)} className="size-drafts-channel-icon" stroke={1.8} />
            {CHANNEL[d.channel] ?? d.channel}{handle ? ` · ${handle}` : ""}
          </span>
        </span>
        <span className="drf-kind">{draftKind(d)}</span>
      </div>
      {d.subject ? <div className="drf-subject"><span>Konu</span><span>{d.subject}</span></div> : null}
      {editing ? (
        <textarea className="drf-edit" value={text} onChange={(e) => setText(e.target.value)} aria-label="Taslak metni" rows={8} autoFocus />
      ) : (
        <p className="drf-text">{text}</p>
      )}
      <div className="drf-meta">{wordsLabel(text)}</div>
      {rejecting ? (
        <RejectPanel busy={busy} onCancel={() => setRejecting(false)} onConfirm={(n) => void confirmReject(n)} />
      ) : (
        <div className="drf-actions">
          <button type="button" className="drf-act is-reject" disabled={busy} onClick={() => { setRejecting(true); setEditing(false); }}>Reddet</button>
          <button type="button" className="drf-act" disabled={busy} onClick={editing ? () => void save() : () => setEditing(true)}>{editing ? "Bitti" : "Düzenle"}</button>
          <span className="flex-grow" />
          <button type="button" className="drf-act is-copy" onClick={() => void copy()}>{copied ? "Kopyalandı" : "Kopyala"}</button>
          <button type="button" className="drf-act is-approve" disabled={busy} onClick={() => void approve()}>
            Onayla, gönderdim
            <span className="drf-act-circle"><BoardIcon name="check" className="size-icon-xs" stroke={2.4} /></span>
          </button>
        </div>
      )}
    </m.article>
  );
}
