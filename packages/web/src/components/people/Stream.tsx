import { useState } from "react";
import { remove, run } from "../../api/actions";
import type { Person } from "../../api/types";
import { openSheet } from "../../app/ui";
import { ago } from "../../lib/format";
import { askDraft, STREAM_SHOWN, type PStatus } from "../../lib/people";
import { channelName } from "../../lib/network";
import { BoardIcon, type BoardIconName } from "../boardIcons";
import { matchesFilter, STREAM_FILTERS, type StreamFilter, type StreamItem, type StreamKind } from "./streamItems";

const ICON: Record<StreamKind, BoardIconName> = { in: "dirIn", out: "dirOut", note: "note", claude: "claude" };
const KIND_LABEL = { arama: "arama", gorusme: "görüşme" } as const;

const stopWaiting = (id: number) => run("patch", `/touches/${id}`, { expects_reply: false }, { ok: "Beklemeden çıkarıldı" }).catch(() => {});
const closeFollowUp = (p: Person) => run("patch", `/people/${p.id}`, { next_follow_up_at: null }, { ok: "Konu kapatıldı" }).catch(() => {});
const resolve = (thread: number) => run("post", `/comments/${thread}/resolve`, { resolved: true }, { ok: "Konu kapatıldı" }).catch(() => {});

/** Edit and delete of an entry, as quiet text buttons in its meta line */
function Tools({ label, onEdit, onDelete }: { label: string; onEdit?: () => void; onDelete: () => void }) {
  return (
    <span className="ppl-tools-row">
      {onEdit ? <button type="button" className="ppl-tool" aria-label={`${label} düzenle`} onClick={onEdit}>Düzenle</button> : null}
      <button type="button" className="ppl-tool is-danger" aria-label={`${label} sil`} onClick={onDelete}>Sil</button>
    </span>
  );
}

/** Edit field of an own note: Enter saves, Esc cancels */
function NoteEdit({ id, value, onChange, onDone }: { id: number; value: string; onChange: (v: string) => void; onDone: () => void }) {
  const save = async () => {
    if (!value.trim()) return;
    await run("patch", `/notes/${id}`, { body: value.trim() }, { ok: "Not güncellendi" }).then(onDone).catch(() => {});
  };
  return (
    <div className="flex gap-3">
      <input className="inp min-w-0 flex-1" aria-label="Notu düzenle" value={value} autoFocus onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), void save()) : e.key === "Escape" ? onDone() : undefined)} />
      <button type="button" className="btn btn-sec" onClick={() => void save()}>Kaydet</button>
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
  const claudeBy = (t?.created_by ?? item.note?.created_by) === "claude";
  const who = t
    ? `${t.direction === "gelen" ? "Gelen" : "Giden"} · ${channelName(t.channel)}${t.kind !== "mesaj" ? ` · ${KIND_LABEL[t.kind]}` : ""}${claudeBy ? " · Claude" : ""}`
    : item.note ? (claudeBy ? "Claude notu" : "Notun")
    : c?.created_by === "claude" ? "Claude yorumu" : "Claude’a yazdın";
  const waiting = lead && item.kind === "out" && !!t?.expects_reply;
  const answer = lead && item.kind === "in" && status !== "ok";
  const openThread = !!th && !th.resolved_at && th.last_id === c?.id;

  return (
    <div className="ppl-item" data-k={item.kind}>
      <span className="ppl-kind"><BoardIcon name={ICON[item.kind]} className="size-icon-xs" stroke={2} /></span>
      <div className="flex min-w-0 flex-grow flex-col gap-2">
        <span className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span className="ppl-kc">{who}</span>
          <span>{ago(item.at)}</span>
          {th?.resolved_at ? <span>· Konu kapandı</span> : null}
          {t ? <Tools label="Temas" onEdit={() => openSheet("touch", { edit: t.id })} onDelete={() => void remove(`/touches/${t.id}`, "Temas").catch(() => {})} /> : null}
          {n ? <Tools label="Not" onEdit={n.created_by === "ozgur" ? () => setDraft(n.body) : undefined} onDelete={() => void remove(`/notes/${n.id}`, "Not").catch(() => {})} /> : null}
        </span>
        {n && draft !== null ? <NoteEdit id={n.id} value={draft} onChange={setDraft} onDone={() => setDraft(null)} /> : <span className="whitespace-pre-line text-base leading-normal text-text-body">{t?.summary ?? n?.body ?? c?.body}</span>}
        {t?.outcome ? <span className="text-sm text-text-secondary">→ {t.outcome}</span> : null}
        {waiting ? (
          <span className="flex flex-wrap gap-2">
            <button type="button" className="ppl-small" onClick={() => void stopWaiting(t!.id)}>Cevap beklemiyorum</button>
            <button type="button" className="ppl-small is-soft" onClick={() => void askDraft(p).catch(() => {})}>Hatırlatma yazsın</button>
          </span>
        ) : null}
        {answer ? (
          <span className="flex flex-wrap gap-2">
            <button type="button" className="ppl-small is-accent" onClick={onAnswer}>Cevapla</button>
            {p.next_follow_up_at ? <button type="button" className="ppl-small" onClick={() => void closeFollowUp(p)}>Konu kapandı</button> : null}
          </span>
        ) : null}
        {openThread ? (
          <span className="flex flex-wrap gap-2">
            {th!.last_by === "claude" ? <button type="button" className="ppl-small is-accent" onClick={() => onReply(th!.id)}>Cevapla</button> : null}
            <button type="button" className="ppl-small" onClick={() => void resolve(th!.id)}>Konu kapandı</button>
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
      <div className="ppl-modes" role="radiogroup" aria-label="Akış">
        {STREAM_FILTERS.map((f) => (
          <button key={f.key} type="button" role="radio" className="ppl-sf" aria-checked={filter === f.key} onClick={() => onFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="ppl-stream flex flex-col">
        {list.map((i) => <Entry key={i.key} item={i} p={person} lead={i.key === leadKey} status={status} onAnswer={onAnswer} onReply={onReply} />)}
        {shown.length === 0 ? <p className="m-0 border-t border-border-subtle py-6 text-base-sm text-text-muted">Burada henüz kayıt yok.</p> : null}
        {shown.length > list.length ? <button type="button" className="btn btn-ghost self-start px-0 text-base-sm" onClick={() => setAll(true)}>{shown.length - list.length} kayıt daha</button> : null}
      </div>
    </>
  );
}
