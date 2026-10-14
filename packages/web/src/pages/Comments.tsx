import { useState } from "react";
import { Link } from "wouter";
import { run } from "../api/actions";
import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { List, Thread } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { Chip, Empty, ErrorBox, Filters, order, PageSkeleton, Who } from "../components/ui";
import { ago } from "../lib/format";
import { TARGET, type Tone } from "../lib/labels";

type F = "open" | "mine" | "claude" | "all";
const FILTERS: { value: F; label: string; test: (t: Thread) => boolean }[] = [
  { value: "open", label: "Cevap bekleyen", test: (t) => !t.resolved_at },
  { value: "mine", label: "Benim cevabımı bekleyen", test: (t) => !t.resolved_at && t.last_by === "claude" },
  { value: "claude", label: "Claude’un cevabını bekleyen", test: (t) => !t.resolved_at && t.last_by === "ozgur" },
  { value: "all", label: "Hepsi", test: () => true },
];
const KIND_TONE: Record<string, Tone> = { opportunity: "opportunity", project: "success", person: "neutral", payment: "payment", draft: "claude" };
const LINKABLE = new Set(["person", "opportunity", "project"]);

export default function Comments() {
  const threads = useQuery<List<Thread>>(K.allThreads);
  // the dashboard links here with ?f=mine (threads waiting for Özgür)
  const [f, setF] = useState<F>(() => FILTERS.find((x) => x.value === new URLSearchParams(location.search).get("f"))?.value ?? "open");
  const shown = (threads.data?.rows ?? []).filter(FILTERS.find((x) => x.value === f)!.test);

  return (
    <Page title="Yorumlar" sub="Sen ve Claude, kayıtların üzerinde yazışırsınız. Cevapsız kalan burada görünür." width="narrow" className="flex flex-col gap-7">
      <div className="rise">
        <Filters label="Yorum filtresi" value={f} onChange={setF} items={FILTERS} />
      </div>
      {threads.error && !threads.data ? <ErrorBox error={threads.error} retry={threads.reload} /> : null}
      {!threads.data ? (
        !threads.error && <PageSkeleton />
      ) : shown.length === 0 ? (
        <div className="card"><Empty>Burada yorum yok.</Empty></div>
      ) : (
        shown.map((t, i) => <ThreadCard key={t.id} t={t} i={i} />)
      )}
    </Page>
  );
}

function ThreadCard({ t, i }: { t: Thread; i: number }) {
  const msgs = t.comments ?? [];
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const st = t.resolved_at
    ? { text: "Çözüldü", tone: "success" as Tone }
    : t.last_by === "ozgur"
      ? { text: "Claude cevap vermedi", tone: "claude" as Tone }
      : { text: "Senin cevabın bekleniyor", tone: "payment" as Tone };

  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await run("post", "/comments", { reply_to: t.id, body: reply.trim() }, { ok: "Cevap yazıldı" });
      setReply("");
    } finally {
      setBusy(false);
    }
  };
  const resolve = async (resolved: boolean) => {
    setBusy(true);
    try {
      await run("post", `/comments/${t.id}/resolve`, { resolved }, { ok: resolved ? "Konu kapatıldı" : "Konu yeniden açıldı" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article data-record={`comment-${t.id}`} className="card rise-item flex flex-col gap-6 px-9 py-8" style={order(i)}>
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={KIND_TONE[t.target_type] ?? "neutral"}>{TARGET[t.target_type] ?? t.target_type}</Chip>
        {LINKABLE.has(t.target_type) ? (
          <Link href={timelinePath(t.target_type as "person", t.target_id)} className="text-md font-semibold text-text-primary">{t.target_label}</Link>
        ) : t.target_type === "own_project" ? (
          <Link href={`${PATHS.ownProjects}/${t.target_id}`} className="text-md font-semibold text-text-primary">{t.target_label}</Link>
        ) : (
          <span className="text-md font-semibold">{t.target_label}</span>
        )}
        <span className="flex-grow" />
        <Chip tone={st.tone}>{st.text}</Chip>
      </div>
      <div className="flex flex-col gap-5">
        {(msgs.length ? msgs : [{ id: t.last_id, created_by: t.last_by, body: t.last_body, created_at: t.last_at }]).map((c) => (
          <div key={c.id} className="flex items-start gap-4">
            <Who actor={c.created_by} className="w-comment-who justify-center" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="whitespace-pre-line text-base leading-normal">{c.body}</span>
              <span className="text-sm text-text-muted">{ago(c.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
      {!t.resolved_at ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
          <textarea className="inp h-control-height-lg min-h-0 min-w-0 flex-1 resize-none py-3" aria-label="Cevap yaz" placeholder="Cevap yaz" rows={1} value={reply}
            onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} />
          <button type="button" className="btn btn-pri h-control-height-lg" disabled={busy || !reply.trim()} onClick={send}>Cevapla</button>
          <button type="button" className="btn btn-sec h-control-height-lg" disabled={busy} onClick={() => resolve(true)}>Çözüldü</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost self-start" disabled={busy} onClick={() => resolve(false)}>Yeniden aç</button>
      )}
    </article>
  );
}
