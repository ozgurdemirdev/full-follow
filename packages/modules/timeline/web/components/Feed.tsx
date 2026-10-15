// Olay akışı: bir kişi, fırsat ya da projenin olayları, temasları ve yorumları tek kronolojik listede.
// Zaman çizelgesi sayfası ve fırsat sayfası aynı parçaları kullanır.
import { useMemo, useState } from "react";
import { run } from "@kit/api/actions";
import { qs } from "@kit/api/client";
import { useQuery } from "@kit/api/store";
import type { List, Thread, Touch } from "@kit/api/types";
import type { TimelineEvent } from "../types";
import { fmtDay } from "@kit/lib/format";
import {
  ACTOR, PROJECT_STAGE, STAGE, STAGE_TONE, TONE_CLS,
  type OppStage, type ProjectStage, type Tone,
} from "@kit/lib/labels";
import { Chip, Empty, order, Who } from "@kit/components/ui";

export type FeedKind = "person" | "opportunity" | "project";
export type FeedGroup = "Temaslar" | "Yorumlar" | "Aşama" | "Görevler" | "Ödemeler" | "Diğer";

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
      const label = t?.kind === "gorusme" ? "Görüşme" : t?.kind === "arama" ? "Arama" : gelen ? "Cevap" : "Mesaj";
      return {
        label, tone: t?.kind === "gorusme" ? "source" : "opportunity", group: "Temaslar",
        text: t?.summary, meta: t?.draft_id ? "Claude taslağı · Özgür onayladı" : t?.outcome ?? undefined,
        byName: gelen ? t?.person_name?.split(" ")[0] : undefined,
      };
    }
    case "opp":
      if (act === "created") return { label: "Bulundu", tone: "source", group: "Aşama" };
      if (act === "stage") return { label: STAGE[d.to as OppStage] ?? "Aşama", tone: STAGE_TONE[d.to as OppStage] ?? "neutral", group: "Aşama", meta: d.reason };
      if (act?.startsWith("person_")) return { label: "Ekip", tone: "claude", group: "Diğer" };
      return { label: "Fırsat", tone: "neutral", group: "Diğer" };
    case "offer":
      return { label: act === "accepted" ? "Teklif kabul" : "Teklif", tone: act === "accepted" ? "success" : "payment", group: "Diğer" };
    case "file":
      return { label: "Dosya", tone: "neutral", group: "Diğer" };
    case "draft":
      return { label: act === "sent" ? "Gönderildi" : "Taslak", tone: act === "rejected" ? "warning" : "claude", group: "Temaslar" };
    case "comment":
      return { label: "Yorum", tone: "neutral", group: "Yorumlar", comment: d.comment_id ? { thread: d.thread, id: d.comment_id } : undefined };
    case "task":
      return { label: act === "done" ? "Görev bitti" : "Görev", tone: "success", group: "Görevler" };
    case "payment":
      return { label: act === "paid" ? "Ödeme alındı" : "Ödeme", tone: "payment", group: "Ödemeler" };
    case "project":
      return { label: act === "stage" ? PROJECT_STAGE[d.to as ProjectStage] ?? "Proje" : "Proje", tone: "success", group: "Diğer" };
    default:
      return { label: ACTOR[e.created_by] ? "Kayıt" : e.type, tone: "neutral", group: "Diğer" };
  }
}

/** Akışın verisi: olaylar, temaslar, yorum konuları ve filtre için açıklanmış satırlar */
export function useFeed(type: FeedKind, id: number) {
  const events = useQuery<TimelineEvent[]>(`/timeline/${type}/${id}?limit=200`);
  const touches = useQuery<List<Touch>>(`/touches${qs({ [`${type}_id`]: id, limit: 1000 })}`);
  const threads = useQuery<List<Thread>>(`/comments${qs({ target_type: type, target_id: id, resolved: "all", messages: true, limit: 50 })}`);
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
      {loaded && items.length === 0 ? <div className="card"><Empty>Henüz olay yok.</Empty></div> : null}
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
      await run("post", "/comments", openThread ? { reply_to: openThread.id, body: text } : { target_type: type, target_id: id, body: text }, { ok: "Yorum eklendi" });
      setBody("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card ml-0 flex flex-col gap-4 px-7 py-6 desk:ml-12">
      <label htmlFor="yorum" className="lab">Yorum ekle · {label} · Claude MCP’den okuyup cevaplar</label>
      <textarea id="yorum" className="inp" placeholder="Not ya da soru yaz" value={body} onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send()} />
      <div className="flex items-center gap-3">
        <Who actor="ozgur" />
        <span className="text-sm text-text-muted">olarak yazıyorsun</span>
        <span className="flex-grow" />
        <button type="button" className="btn btn-pri" disabled={busy || !body.trim()} onClick={send}>Yorumu ekle</button>
      </div>
    </div>
  );
}
