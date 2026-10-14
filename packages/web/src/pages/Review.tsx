import { useState, type ReactNode } from "react";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import type { ReviewSuggestion, ReviewWeek, WeeklyReview } from "../api/types";
import { Page } from "../app/Page";
import { Icon } from "../components/icons";
import { SectionHead } from "../components/report/SectionHead";
import { Card, Empty, ErrorBox, Meter, order, PageSkeleton } from "../components/ui";
import { fmtDay, pct } from "../lib/format";
import { TEMPLATE_KIND } from "../lib/labels";
import { channelName } from "../lib/network";

/** One number of the week with last week's value under it */
function Stat({ title, value, prev, children }: { title: string; value: ReactNode; prev: ReactNode; children?: ReactNode }) {
  return (
    <div className="rev-stat">
      <span className="rev-stat-title">{title}</span>
      <span className="rev-stat-num">{value}</span>
      {children}
      <span className="rev-stat-prev">geçen hafta {prev}</span>
    </div>
  );
}

function Numbers({ r }: { r: WeeklyReview }) {
  const w = r.this_week;
  const l = r.last_week;
  const added = (x: ReviewWeek) => x.new_people + x.new_companies;
  return (
    <Card label="Haftanın sayıları" className="rep-card rise" style={order(1)}>
      <div className="rev-stats">
        <Stat title="Giden mesaj" value={r.target ? <>{w.sent} <small>/ {r.target}</small></> : w.sent} prev={l.sent}>
          {r.target ? <Meter value={(w.sent / r.target) * 100} size="sm" color={w.sent >= r.target ? "bg-success" : "bg-warning"} label="Haftalık hedef" /> : null}
        </Stat>
        <Stat title="Dönüş oranı" value={pct(w.reply_rate)} prev={pct(l.reply_rate)} />
        <Stat title="Görüşme · teklif" value={`${w.meetings} · ${w.offers}`} prev={`${l.meetings} · ${l.offers}`} />
        <Stat title="Yeni kayıt" value={added(w)} prev={added(l)}>
          <span className="rev-stat-prev">{w.new_people} kişi, {w.new_companies} firma</span>
        </Stat>
      </div>
    </Card>
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
    <Card label="Öne çıkanlar" className="rep-card rep-flush rise" style={order(2)}>
      <SectionHead title="Öne çıkanlar" />
      {rows.length ? rows.map((x) => (
        <div key={x.key} className="rev-row">
          <span className="rev-row-title">{x.title}</span>
          <span className="rev-row-text">{x.text}</span>
        </div>
      )) : <Empty>Bu hafta öne çıkan bir şablon, kaynak ya da limit aşımı yok.</Empty>}
    </Card>
  );
}

function Suggestion({ s, due }: { s: ReviewSuggestion; due: string }) {
  const [added, setAdded] = useState(false);
  const toTask = async () => {
    await run("post", "/tasks", { title: s.task_title, due_date: due }, { ok: `Görev eklendi (${fmtDay(due)})` });
    setAdded(true);
  };
  return (
    <div className="rev-row">
      <span className="rev-row-text">{s.text}</span>
      <button type="button" className="rev-btn" disabled={added} onClick={() => void toTask().catch(() => {})}>
        {added ? "Görev eklendi" : "Göreve çevir"}
      </button>
    </div>
  );
}

function Suggestions({ r }: { r: WeeklyReview }) {
  return (
    <Card label="Gelecek hafta için öneriler" className="rep-card rep-flush rise" style={order(3)}>
      <SectionHead title="Gelecek hafta için öneriler">
        <span className="rep-aside">görev {fmtDay(r.next_monday)} pazartesiye</span>
      </SectionHead>
      {r.suggestions.map((s) => <Suggestion key={`${r.week}-${s.key}`} s={s} due={r.next_monday} />)}
    </Card>
  );
}

/** Weekly review: one ISO week at a time, pills for the previous, current and next week */
export default function Review() {
  const [week, setWeek] = useState<string | null>(null);
  const q = useQuery<WeeklyReview>(`/review${week ? `?week=${week}` : ""}`);
  const r = q.data;
  const nav = r ? (
    <div className="ff-seg rev-nav" role="group" aria-label="Hafta">
      <button type="button" aria-label="Önceki hafta" onClick={() => setWeek(r.prev_week)}>
        <Icon name="arrow" className="size-icon-md rotate-180" />Önceki
      </button>
      <button type="button" aria-pressed={r.current} onClick={() => setWeek(null)}>Bu hafta</button>
      <button type="button" aria-label="Sonraki hafta" disabled={!r.next_week} onClick={() => setWeek(r.next_week)}>
        Sonraki<Icon name="arrow" className="size-icon-md" />
      </button>
    </div>
  ) : null;

  return (
    <Page title="Haftalık inceleme" sub={r ? `${Number(r.week.slice(-2))}. hafta · ${fmtDay(r.start)} → ${fmtDay(r.end)}${r.current ? " · bu hafta" : ""}` : ""} right={nav} width="narrow">
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
