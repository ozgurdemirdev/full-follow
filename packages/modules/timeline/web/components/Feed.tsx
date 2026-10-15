// Olay akışı: bir kişi, fırsat ya da projenin olayları, temasları ve yorumları tek kronolojik listede.
// Zaman çizelgesi sayfası ve fırsat sayfası aynı parçaları kullanır.
import { useMemo, useState } from "react";
import { run } from "@kit/api/actions";
import { qs } from "@kit/api/client";
import { useQuery } from "@kit/api/store";
import type { List, Thread, Touch } from "@kit/api/types";
import { RECORD_EVENTS_LIMIT, THREADS_LIMIT, TOUCHES_LIMIT } from "../constants";
import { m } from "../messages";
import type { TimelineEvent } from "../types";
import { fmtDay } from "@kit/lib/format";
import {
  ACTOR, PROJECT_STAGE, STAGE, STAGE_TONE, TONE_CLS,
  type OppStage, type ProjectStage, type Tone,
} from "@kit/lib/labels";
import { Chip, Empty, order, Who } from "@kit/components/ui";

export type FeedKind = "person" | "opportunity" | "project";
/** The display name of the filter group an event belongs to (`m.feedGroups`) */
export type FeedGroup = string;

export interface Described {
  label: string;
  tone: Tone;
  group: FeedGroup;
  text?: string;
  meta?: string;
  byName?: string;
  comment?: { thread: number; id: number };
}
export interface FeedItem {
  e: TimelineEvent;
  k: Described;
}

/** Olay satırının başlığı, tonu ve hangi filtre grubuna girdiği */
export function describe(e: TimelineEvent, touches: Map<number, Touch>): Described {
  const d = (e.data ?? {}) as Record<string, any>;
  const [res, act] = e.type.split(".");
  switch (res) {
    case "touch": {
      const t = touches.get(d.touch_id);
      const gelen = (t?.direction ?? d.direction) === "gelen";
      const label = t?.kind === "gorusme" ? m.feedTouch.meeting : t?.kind === "arama" ? m.feedTouch.call : gelen ? m.feedTouch.reply : m.feedTouch.message;
      return {
        label, tone: t?.kind === "gorusme" ? "source" : "opportunity", group: m.feedGroups.touches,
        text: t?.summary, meta: t?.draft_id ? m.feedTouch.approvedDraft : t?.outcome ?? undefined,
        byName: gelen ? t?.person_name?.split(" ")[0] : undefined,
      };
    }
    case "opp":
      if (act === "created") return { label: m.feed.found, tone: "source", group: m.feedGroups.stage };
      if (act === "stage") return { label: STAGE[d.to as OppStage] ?? m.feed.stage, tone: STAGE_TONE[d.to as OppStage] ?? "neutral", group: m.feedGroups.stage, meta: d.reason };
      if (act?.startsWith("person_")) return { label: m.feed.team, tone: "claude", group: m.feedGroups.other };
      return { label: m.feed.opportunity, tone: "neutral", group: m.feedGroups.other };
    case "offer":
      return { label: act === "accepted" ? m.feed.offerAccepted : m.feed.offer, tone: act === "accepted" ? "success" : "payment", group: m.feedGroups.other };
    case "file":
      return { label: m.feed.file, tone: "neutral", group: m.feedGroups.other };
    case "draft":
      return { label: act === "sent" ? m.feed.sent : m.feed.draft, tone: act === "rejected" ? "warning" : "claude", group: m.feedGroups.touches };
    case "comment":
      return { label: m.feed.comment, tone: "neutral", group: m.feedGroups.comments, comment: d.comment_id ? { thread: d.thread, id: d.comment_id } : undefined };
    case "task":
      return { label: act === "done" ? m.feed.taskDone : m.feed.task, tone: "success", group: m.feedGroups.tasks };
    case "payment":
      return { label: act === "paid" ? m.feed.paid : m.feed.payment, tone: "payment", group: m.feedGroups.payments };
    case "project":
      return { label: act === "stage" ? PROJECT_STAGE[d.to as ProjectStage] ?? m.feed.project : m.feed.project, tone: "success", group: m.feedGroups.other };
    default:
      return { label: ACTOR[e.created_by] ? m.feed.record : e.type, tone: "neutral", group: m.feedGroups.other };
  }
}

/** Akışın verisi: olaylar, temaslar, yorum konuları ve filtre için açıklanmış satırlar */
export function useFeed(type: FeedKind, id: number) {
  const events = useQuery<TimelineEvent[]>(`/timeline/${type}/${id}?limit=${RECORD_EVENTS_LIMIT}`);
  const touches = useQuery<List<Touch>>(`/touches${qs({ [`${type}_id`]: id, limit: TOUCHES_LIMIT })}`);
  const threads = useQuery<List<Thread>>(`/comments${qs({ target_type: type, target_id: id, resolved: "all", messages: true, limit: THREADS_LIMIT })}`);
  const commentById = useMemo(() => new Map((threads.data?.rows ?? []).flatMap((t) => t.comments ?? []).map((c) => [c.id, c.body])), [threads.data]);
  const touchById = useMemo(() => new Map((touches.data?.rows ?? []).map((t) => [t.id, t])), [touches.data]);
  const items = useMemo<FeedItem[]>(() => (events.data ?? []).map((e) => ({ e, k: describe(e, touchById) })), [events.data, touchById]);
  const openThread = threads.data?.rows.find((t) => !t.resolved_at);
  return { events, touches: touches.data?.rows ?? [], items, commentById, openThread };
}

/** Olay kartları (kronolojik). Boşsa ve olaylar yüklendiyse boş durum gösterir. */
export function FeedItems({ items, commentById, loaded }: { items: FeedItem[]; commentById: Map<number, string>; loaded: boolean }) {
  return (
    <>
      {loaded && items.length === 0 ? <div className="card"><Empty>{m.feed.empty}</Empty></div> : null}
      {items.map(({ e, k }, i) => (
        <div key={e.id} className="tl-ev rise-item relative flex gap-7 pb-8" style={order(i)}>
          <div className={`relative z-0 flex size-tl-node flex-none items-center justify-center rounded-pill border-2 border-bg-canvas ${TONE_CLS[k.tone]}`}>
            <span className="dot bg-current" />
          </div>
          <div className="card flex min-w-0 flex-grow flex-col gap-3 px-7 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <Chip tone={k.tone}>{k.label}</Chip>
              {k.byName ? <span className="who bg-chip-neutral-bg text-chip-neutral-fg">{k.byName}</span> : <Who actor={e.created_by} />}
              <span className="flex-grow" />
              <time className="text-sm text-text-secondary" dateTime={e.created_at}>{fmtDay(e.created_at)}</time>
            </div>
            {k.comment ? <p className="m-0 whitespace-pre-line text-base leading-normal">{commentById.get(k.comment.id) ?? e.summary.replace(/^.*?\):\s*/, "")}</p> : <p className="m-0 whitespace-pre-line text-base leading-normal">{k.text ?? e.summary}</p>}
            {k.meta ? <span className="text-sm text-text-muted">{k.meta}</span> : null}
          </div>
        </div>
      ))}
    </>
  );
}

/** Yorum kutusu: açık konu varsa ona cevap, yoksa yeni konu */
export function FeedComposer({ type, id, label, openThread }: { type: FeedKind; id: number; label: string; openThread?: Thread }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await run("post", "/comments", openThread ? { reply_to: openThread.id, body: text } : { target_type: type, target_id: id, body: text }, { ok: m.feed.commentAdded });
      setBody("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card ml-0 flex flex-col gap-4 px-7 py-6 desk:ml-12">
      <label htmlFor="yorum" className="lab">{m.feed.commentLabel(label)}</label>
      <textarea id="yorum" className="inp" placeholder={m.feed.commentPlaceholder} value={body} onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send()} />
      <div className="flex items-center gap-3">
        <Who actor="ozgur" />
        <span className="text-sm text-text-muted">{m.feed.writingAs}</span>
        <span className="flex-grow" />
        <button type="button" className="btn btn-pri" disabled={busy || !body.trim()} onClick={send}>{m.feed.addComment}</button>
      </div>
    </div>
  );
}
