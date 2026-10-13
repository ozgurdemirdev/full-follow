import { useState, type ReactNode } from "react";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import type { ReviewSuggestion, ReviewWeek, WeeklyReview } from "../api/types";
import { Page } from "../app/Page";
import { Icon } from "../components/icons";
import { CardHead, Empty, ErrorBox, order, PageSkeleton } from "../components/ui";
import { fmtDay, pct } from "../lib/format";
import { TEMPLATE_KIND } from "../lib/labels";
import { channelName } from "../lib/network";

/** One number of the week with last week's value under it */
function Stat({ title, value, prev, children }: { title: string; value: ReactNode; prev: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm text-text-secondary">{title}</span>
      <span className="kpi">{value}</span>
      {children}
      <span className="text-sm text-text-muted">geçen hafta {prev}</span>
    </div>
  );
}

function Numbers({ r }: { r: WeeklyReview }) {
  const w = r.this_week;
  const l = r.last_week;
  const added = (x: ReviewWeek) => x.new_people + x.new_companies;
  return (
    <section className="card rise grid grid-cols-2 gap-x-7 gap-y-9 p-9 desk:grid-cols-4" style={order(1)} aria-label="Haftanın sayıları">
      <Stat title="Giden mesaj" value={r.target ? `${w.sent} / ${r.target}` : w.sent} prev={l.sent}>
        {r.target ? (
          <span className="track">
            <i className={`grow-x ${w.sent >= r.target ? "bg-status-text-success" : "bg-accent-payment"}`} style={{ width: `${Math.min(100, (w.sent / r.target) * 100)}%` }} />
          </span>
        ) : null}
      </Stat>
      <Stat title="Dönüş oranı" value={pct(w.reply_rate)} prev={pct(l.reply_rate)} />
      <Stat title="Görüşme · teklif" value={`${w.meetings} · ${w.offers}`} prev={`${l.meetings} · ${l.offers}`} />
      <Stat title="Yeni kayıt" value={added(w)} prev={added(l)}>
        <span className="text-sm text-text-secondary">{w.new_people} kişi, {w.new_companies} firma</span>
      </Stat>
    </section>
  );
}

/** Template groups with a clear leader or small-sample templates, source best and weakest, channels that hit the daily limit */
function Highlights({ r }: { r: WeeklyReview }) {
  const { best, weakest } = r.sources;
  const full = r.quota.filter((c) => c.over_days);
  const rows: { key: string; title: string; text: string }[] = [
    ...r.templates.map((g) => ({
      key: `${g.kind}/${g.channel}`,
      title: `${TEMPLATE_KIND[g.kind] ?? g.kind} · ${g.channel ? channelName(g.channel) : "Tüm kanallar"}`,
      text: [g.leader ? `“${g.leader.name}” önde ${pct(g.leader.reply_rate)}` : "", g.loser ? `“${g.loser.name}” geride ${pct(g.loser.reply_rate)}` : "", g.early ? `${g.early} şablon erken` : ""].filter(Boolean).join(" · "),
    })),
    ...(best || weakest
      ? [{ key: "sources", title: "Kaynaklar", text: [best ? `en iyi ${best.source} ${pct(best.reply_rate)}` : "", weakest ? `zayıf ${weakest.source} ${pct(weakest.reply_rate)}` : ""].filter(Boolean).join(" · ") }]
      : []),
    ...full.map((c) => ({ key: `quota-${c.channel}`, title: `${channelName(c.channel)} günlük limit`, text: `${c.over_days} gün doldu (limit ${c.limit}, en çok ${c.max_sent})` })),
  ];
  return (
    <section className="card rise overflow-hidden" style={order(2)} aria-label="Öne çıkanlar">
      <CardHead title="Öne çıkanlar" />
      {rows.length ? rows.map((x) => (
        <div key={x.key} className="row flex flex-col gap-1 px-9 py-5">
          <span className="text-sm text-text-secondary">{x.title}</span>
          <span className="text-base">{x.text}</span>
        </div>
      )) : <Empty>Bu hafta öne çıkan bir şablon, kaynak ya da limit aşımı yok.</Empty>}
    </section>
  );
}

function Suggestion({ s, due }: { s: ReviewSuggestion; due: string }) {
  const [added, setAdded] = useState(false);
  const toTask = async () => {
    await run("post", "/tasks", { title: s.task_title, due_date: due }, { ok: `Görev eklendi (${fmtDay(due)})` });
    setAdded(true);
  };
  return (
    <div className="row flex flex-wrap items-center gap-x-5 gap-y-3 px-9 py-5">
      <span className="min-w-0 flex-grow basis-full text-base desk:basis-0">{s.text}</span>
      <button type="button" className="btn btn-sec btn-sm" disabled={added} onClick={() => void toTask().catch(() => {})}>
        {added ? "Görev eklendi" : "Göreve çevir"}
      </button>
    </div>
  );
}

function Suggestions({ r }: { r: WeeklyReview }) {
  return (
    <section className="card rise overflow-hidden" style={order(3)} aria-label="Gelecek hafta için öneriler">
      <CardHead title="Gelecek hafta için öneriler">
        <span className="text-sm text-text-secondary">görev {fmtDay(r.next_monday)} pazartesiye</span>
      </CardHead>
      {r.suggestions.map((s) => <Suggestion key={`${r.week}-${s.key}`} s={s} due={r.next_monday} />)}
    </section>
  );
}

/** Weekly review: one ISO week at a time, arrows for the previous and next week */
export default function Review() {
  const [week, setWeek] = useState<string | null>(null);
  const q = useQuery<WeeklyReview>(`/review${week ? `?week=${week}` : ""}`);
  const r = q.data;
  const arrows = r ? (
    <div className="ml-auto flex items-center gap-3">
      <button type="button" className="ibtn" aria-label="Önceki hafta" onClick={() => setWeek(r.prev_week)}>
        <Icon name="arrow" className="size-icon-lg rotate-180" />
      </button>
      <button type="button" className="ibtn" aria-label="Sonraki hafta" disabled={!r.next_week} onClick={() => setWeek(r.next_week)}>
        <Icon name="arrow" />
      </button>
    </div>
  ) : null;

  return (
    <Page title="Haftalık inceleme" sub={r ? `${Number(r.week.slice(-2))}. hafta · ${fmtDay(r.start)} → ${fmtDay(r.end)}${r.current ? " · bu hafta" : ""}` : ""} right={arrows} width="narrow">
      {q.error && !r ? <ErrorBox error={q.error} retry={q.reload} /> : null}
      {!r ? !q.error && <PageSkeleton /> : (
        <>
          <Numbers r={r} />
          <Highlights r={r} />
          <Suggestions r={r} />
        </>
      )}
    </Page>
  );
}
