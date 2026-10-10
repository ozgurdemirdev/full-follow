import { useState } from "react";
import { Link } from "wouter";
import { run } from "../api/actions";
import { K, useOpps, usePeople } from "../api/keys";
import { useQuery } from "../api/store";
import type { Draft, List } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { toast } from "../components/toast";
import { Chip, Empty, ErrorBox, order, PageSkeleton, Segmented, Who } from "../components/ui";
import { ago } from "../lib/format";
import { useIsDesktop } from "../lib/media";
import { CHANNEL, STAGE } from "../lib/labels";
import { openSheet } from "../app/ui";

const TABS: { label: string; test: (d: Draft) => boolean }[] = [
  { label: "Onay bekliyor", test: (d) => d.status === "bekliyor" || d.status === "onaylandi" },
  { label: "Gönderildi", test: (d) => d.status === "gonderildi" },
  { label: "Reddedildi", test: (d) => d.status === "reddedildi" },
];

export default function Drafts() {
  const drafts = useQuery<List<Draft>>(K.drafts);
  const desk = useIsDesktop();
  const [tab, setTab] = useState(0);
  const rows = drafts.data?.rows ?? [];
  const counts = TABS.map((t) => rows.filter(t.test).length);
  const shown = rows.filter(TABS[tab].test);

  return (
    <Page title="Taslaklar" sub="Claude yazar, sen onaylayıp gönderirsin. Gönderilen taslak temas olarak kaydedilir." width="narrow" className="flex flex-col gap-7"
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("draft")}>Taslak yaz</button>}>
      {drafts.error && !drafts.data ? <ErrorBox error={drafts.error} retry={drafts.reload} /> : null}
      {!drafts.data ? (
        !drafts.error && <PageSkeleton />
      ) : (
        <>
          <Segmented label="Taslak durumu" items={TABS.map((t, i) => `${t.label} (${counts[i]})`)} value={tab} onChange={setTab}
            width={desk ? "var(--spacing-seg-tab-wide)" : "var(--spacing-seg-tab-mobile)"} />
          {shown.length === 0 ? <div className="card"><Empty>Burada şu an taslak yok.</Empty></div> : null}
          {shown.map((d, i) => <DraftCard key={d.id} d={d} i={i} />)}
        </>
      )}
    </Page>
  );
}

function DraftCard({ d, i }: { d: Draft; i: number }) {
  const people = usePeople();
  const opps = useOpps();
  const person = d.person_id ? people.byId.get(d.person_id) : undefined;
  const opp = d.opportunity_id ? opps.byId.get(d.opportunity_id) : undefined;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.body);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = d.status === "bekliyor" || d.status === "onaylandi";

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const save = () => act(async () => {
    await run("patch", `/drafts/${d.id}`, { body: text }, { ok: "Taslak güncellendi" });
    setEditing(false);
  });
  const send = () => act(async () => {
    if (editing && text !== d.body) await run("patch", `/drafts/${d.id}`, { body: text }, { silent: true });
    await run("post", `/drafts/${d.id}/send`, undefined, { ok: "Gönderildi, temas olarak kaydedildi" });
  });
  const reject = () => act(() => run("post", `/drafts/${d.id}/reject`, { note }, { ok: "Taslak reddedildi" }));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editing ? text : d.body);
      toast("Metin kopyalandı");
    } catch {
      toast("Kopyalanamadı", "error");
    }
  };

  return (
    <article className="card rise-item flex flex-col gap-5 px-9 py-8" style={order(i)}>
      <div className="flex flex-wrap items-center gap-3">
        {d.person_id ? <Link href={timelinePath("person", d.person_id)} className="text-md font-semibold text-text-primary">{d.to_name}</Link>
          : d.company_id ? <Link href={`${PATHS.companies}/${d.company_id}`} className="text-md font-semibold text-text-primary">{d.to_name}</Link>
          : <span className="text-md font-semibold">{d.to_name}</span>}
        {person?.company_name ? <span className="text-base-sm text-text-secondary">{person.company_name}</span> : null}
        <span className="flex-grow" />
        {opp ? <Chip tone="opportunity">{opp.title} · {STAGE[opp.stage]}</Chip> : null}
        {d.followup_step ? <Chip tone="claude">{d.followup_step}. takip</Chip> : null}
        <Chip>{CHANNEL[d.channel] ?? d.channel}</Chip>
      </div>
      <div className="flex items-center gap-3">
        <Who actor={d.created_by} />
        <span className="text-base-sm text-text-secondary">{ago(d.created_at)} hazırladı</span>
      </div>
      {d.reason ? <p className="m-0 text-base-sm text-text-secondary"><span className="font-medium text-author-claude-fg">Neden şimdi: </span>{d.reason}</p> : null}
      {editing ? (
        <textarea className="inp min-h-textarea-lg border-primary text-base leading-relaxed" aria-label="Taslak metni" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      ) : (
        <p className="inset m-0 whitespace-pre-line px-7 py-6 text-base leading-relaxed">{d.body}</p>
      )}
      {pending && rejecting ? (
        <div className="flex flex-col gap-3">
          <input className="inp" placeholder="Neden? Claude yeni taslakta buna göre yazar" aria-label="Ret nedeni" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="flex gap-3">
            <button type="button" className="btn btn-pri" disabled={busy || !note.trim()} onClick={reject}>Reddet</button>
            <button type="button" className="btn btn-sec" onClick={() => setRejecting(false)}>Vazgeç</button>
          </div>
        </div>
      ) : pending ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-pri" disabled={busy} onClick={send}>Onayla, gönderdim</button>
          <button type="button" className="btn btn-sec" disabled={busy} onClick={editing ? save : () => setEditing(true)}>{editing ? "Kaydet" : "Düzenle"}</button>
          <button type="button" className="btn btn-sec" onClick={copy}>Kopyala</button>
          <span className="flex-grow" />
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setRejecting(true)}>Reddet</button>
        </div>
      ) : (
        <span className={`text-base-sm ${d.status === "gonderildi" ? "text-status-text-success" : "text-status-text-danger"}`}>
          {d.status === "gonderildi" ? "Gönderildi · temas olarak kaydedildi" : `Reddedildi${d.reject_note ? `: ${d.reject_note}` : ""} · Claude yeni bir taslak önerebilir`}
        </span>
      )}
    </article>
  );
}
