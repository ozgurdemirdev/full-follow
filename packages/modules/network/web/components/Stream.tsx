import { useState } from "react";
import { remove, run } from "@kit/api/actions";
import type { Person } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { ago } from "@kit/lib/format";
import { askDraft, STREAM_SHOWN, type PStatus } from "@kit/lib/people";
import { channelName } from "@kit/lib/network";
import { useTasksOn } from "@kit/lib/taskAccess";
import { BoardIcon, type BoardIconName } from "@kit/components/boardIcons";
import { m } from "../messages";
import { matchesFilter, STREAM_FILTERS, type StreamFilter, type StreamItem, type StreamKind } from "./streamItems";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

const ICON: Record<StreamKind, BoardIconName> = { in: "dirIn", out: "dirOut", note: "note", claude: "claude" };
const KIND_LABEL = { arama: m.streamKinds.arama, gorusme: m.streamKinds.gorusme } as const;

export const stopWaiting = (id: number) => run("patch", `/touches/${id}`, { expects_reply: false }, { ok: m.stream.stoppedOk }).catch(() => {});
const closeFollowUp = (p: Person) => run("patch", `/people/${p.id}`, { next_follow_up_at: null }, { ok: m.stream.closedOk }).catch(() => {});
export const resolve = (thread: number) => run("post", `/comments/${thread}/resolve`, { resolved: true }, { ok: m.stream.closedOk }).catch(() => {});

/** Edit and delete of an entry, as quiet text buttons in its meta line */
export function Tools({ label, onEdit, onDelete }: { label: string; onEdit?: () => void; onDelete: () => void }) {
  return (
    <span className="ppl-tools-row">
      {onEdit ? <button type="button" className="ppl-tool" aria-label={m.stream.editTouch(label)} onClick={onEdit}>{kit.edit}</button> : null}
      <button type="button" className="ppl-tool is-danger" aria-label={m.stream.deleteTouch(label)} onClick={onDelete}>{kit.delete}</button>
    </span>
  );
}

/** Edit field of an own note: Enter saves, Esc cancels */
function NoteEdit({ id, value, onChange, onDone }: { id: number; value: string; onChange: (v: string) => void; onDone: () => void }) {
  const save = async () => {
    if (!value.trim()) return;
    await run("patch", `/notes/${id}`, { body: value.trim() }, { ok: m.stream.noteUpdated }).then(onDone).catch(() => {});
  };
  return (
    <div className="flex gap-3">
      <input className="inp min-w-0 flex-1" aria-label={m.stream.editNote} value={value} autoFocus onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), void save()) : e.key === "Escape" ? onDone() : undefined)} />
      <button type="button" className="btn btn-sec" onClick={() => void save()}>{kit.save}</button>
    </div>
  );
}

function Entry({ item, p, lead, status, onAnswer, onReply }: {
  item: StreamItem;
  p: Person;
  lead: boolean;
  status: PStatus;
  onAnswer: () => void;
  onReply: (thread: number) => void;
}) {
  const { touch: t, note: n, comment: c, thread: th } = item;
  const [draft, setDraft] = useState<string | null>(null);
  const tasksOn = useTasksOn();
  const claudeBy = (t?.created_by ?? item.note?.created_by) === "claude";
  const who = t
    ? m.stream.who(t.direction === "gelen" ? m.stream.incoming : m.stream.outgoing, channelName(t.channel), t.kind !== "mesaj" ? KIND_LABEL[t.kind] : undefined, claudeBy)
    : item.note ? (claudeBy ? m.stream.claudeNote : m.stream.yourNote)
    : c?.created_by === "claude" ? m.stream.claudeComment : m.stream.youWrote;
  const waiting = lead && item.kind === "out" && !!t?.expects_reply;
  const answer = lead && item.kind === "in" && status !== "ok";
  const openThread = !!th && !th.resolved_at && th.last_id === c?.id;

  return (
    <div className="ppl-item" data-k={item.kind}>
      <span className="ppl-kind"><BoardIcon name={ICON[item.kind]} className="size-icon-xs" stroke={STROKE.regular} /></span>
      <div className="flex min-w-0 flex-grow flex-col gap-2">
        <span className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span className="ppl-kc">{who}</span>
          <span>{ago(item.at)}</span>
          {th?.resolved_at ? <span>· {m.common.resolved}</span> : null}
          {t ? <Tools label={m.stream.touch} onEdit={() => openSheet("touch", { edit: t.id })} onDelete={() => void remove(`/touches/${t.id}`, m.stream.touch).catch(() => {})} /> : null}
          {n ? <Tools label={m.stream.note} onEdit={n.created_by === "ozgur" ? () => setDraft(n.body) : undefined} onDelete={() => void remove(`/notes/${n.id}`, m.stream.note).catch(() => {})} /> : null}
        </span>
        {n && draft !== null ? <NoteEdit id={n.id} value={draft} onChange={setDraft} onDone={() => setDraft(null)} /> : <span className="whitespace-pre-line text-base leading-normal text-text-body">{t?.summary ?? n?.body ?? c?.body}</span>}
        {t?.outcome ? <span className="text-sm text-text-secondary">→ {t.outcome}</span> : null}
        {waiting ? (
          <span className="flex flex-wrap gap-2">
            <button type="button" className="ppl-small" onClick={() => void stopWaiting(t!.id)}>{m.stream.stopWaiting}</button>
            {tasksOn ? <button type="button" className="ppl-small is-soft" onClick={() => void askDraft(p).catch(() => {})}>{m.stream.remind}</button> : null}
          </span>
        ) : null}
        {answer ? (
          <span className="flex flex-wrap gap-2">
            <button type="button" className="ppl-small is-accent" onClick={onAnswer}>{kit.reply}</button>
            {p.next_follow_up_at ? <button type="button" className="ppl-small" onClick={() => void closeFollowUp(p)}>{m.common.resolved}</button> : null}
          </span>
        ) : null}
        {openThread ? (
          <span className="flex flex-wrap gap-2">
            {th!.last_by === "claude" ? <button type="button" className="ppl-small is-accent" onClick={() => onReply(th!.id)}>{kit.reply}</button> : null}
            <button type="button" className="ppl-small" onClick={() => void resolve(th!.id)}>{m.common.resolved}</button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The filter pills and the entries of the person's stream (touches, notes, Claude comments) */
export function Stream({ items, person, status, filter, onFilter, chan, onAnswer, onReply }: {
  items: StreamItem[];
  person: Person;
  status: PStatus;
  filter: StreamFilter;
  onFilter: (f: StreamFilter) => void;
  /** only touches of this channel when set */
  chan: string | null;
  onAnswer: () => void;
  onReply: (thread: number) => void;
}) {
  const [all, setAll] = useState(false);
  const leadKey = items.find((i) => i.touch)?.key;
  const shown = items.filter((i) => matchesFilter(i, filter) && (!chan || i.touch?.channel === chan));
  const list = all ? shown : shown.slice(0, STREAM_SHOWN);
  return (
    <>
      <div className="ppl-modes" role="radiogroup" aria-label={m.stream.label}>
        {STREAM_FILTERS.map((f) => (
          <button key={f.key} type="button" role="radio" className="ppl-sf" aria-checked={filter === f.key} onClick={() => onFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="ppl-stream flex flex-col">
        {list.map((i) => <Entry key={i.key} item={i} p={person} lead={i.key === leadKey} status={status} onAnswer={onAnswer} onReply={onReply} />)}
        {shown.length === 0 ? <p className="m-0 border-t border-border-subtle py-6 text-base-sm text-text-muted">{m.common.noRecords}</p> : null}
        {shown.length > list.length ? <button type="button" className="btn btn-ghost self-start px-0 text-base-sm" onClick={() => setAll(true)}>{m.common.moreRecords(shown.length - list.length)}</button> : null}
      </div>
    </>
  );
}
