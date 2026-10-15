import { useState, type ReactNode } from "react";
import { run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { ReviewSuggestion, ReviewWeek, WeeklyReview } from "../types";
import { Page } from "@kit/app/Page";
import { Icon } from "@kit/components/icons";
import { SectionHead } from "@kit/components/SectionHead";
import { Card, Empty, ErrorBox, Meter, order, PageSkeleton } from "@kit/components/ui";
import { fmtDay, pct } from "@kit/lib/format";
import { TEMPLATE_KIND } from "@kit/lib/labels";
import { channelName } from "@kit/lib/network";
import { PERCENT } from "../constants";
import { m } from "../messages";

/** One number of the week with last week's value under it */
function Stat({ title, value, prev, children }: { title: string; value: ReactNode; prev: ReactNode; children?: ReactNode }) {
  return (
    <div className="rev-stat">
      <span className="rev-stat-title">{title}</span>
      <span className="rev-stat-num">{value}</span>
      {children}
      <span className="rev-stat-prev">{m.review.lastWeek} {prev}</span>
    </div>
  );
}

function Numbers({ r }: { r: WeeklyReview }) {
  const w = r.this_week;
  const l = r.last_week;
  const added = (x: ReviewWeek) => x.new_people + x.new_companies;
  return (
    <Card label={m.review.numbers} className="rep-card rise" style={order(1)}>
      <div className="rev-stats">
        <Stat title={m.review.sent} value={r.target ? <>{w.sent} <small>/ {r.target}</small></> : w.sent} prev={l.sent}>
          {r.target ? <Meter value={(w.sent / r.target) * PERCENT} size="sm" color={w.sent >= r.target ? "bg-success" : "bg-warning"} label={m.review.weeklyTarget} /> : null}
        </Stat>
        <Stat title={m.review.replyRate} value={pct(w.reply_rate)} prev={pct(l.reply_rate)} />
        <Stat title={m.review.meetingsOffers} value={`${w.meetings} · ${w.offers}`} prev={`${l.meetings} · ${l.offers}`} />
        <Stat title={m.review.newRecords} value={added(w)} prev={added(l)}>
          <span className="rev-stat-prev">{m.review.newPeopleCompanies(w.new_people, w.new_companies)}</span>
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
      title: `${TEMPLATE_KIND[g.kind] ?? g.kind} · ${g.channel ? channelName(g.channel) : m.review.allChannels}`,
      text: [g.leader ? m.review.leader(g.leader.name, pct(g.leader.reply_rate)) : "", g.loser ? m.review.loser(g.loser.name, pct(g.loser.reply_rate)) : "", g.early ? m.review.early(g.early) : ""].filter(Boolean).join(" · "),
    })),
    ...(best || weakest
      ? [{ key: "sources", title: m.review.sources, text: [best ? m.review.best(best.source, pct(best.reply_rate)) : "", weakest ? m.review.weakest(weakest.source, pct(weakest.reply_rate)) : ""].filter(Boolean).join(" · ") }]
      : []),
    ...full.map((c) => ({ key: `quota-${c.channel}`, title: m.review.dailyLimit(channelName(c.channel)), text: m.review.limitFull(c.over_days, c.limit, c.max_sent) })),
  ];
  return (
    <Card label={m.review.highlights} className="rep-card rep-flush rise" style={order(2)}>
      <SectionHead title={m.review.highlights} />
      {rows.length ? rows.map((x) => (
        <div key={x.key} className="rev-row">
          <span className="rev-row-title">{x.title}</span>
          <span className="rev-row-text">{x.text}</span>
        </div>
      )) : <Empty>{m.review.nothing}</Empty>}
    </Card>
  );
}

function Suggestion({ s, due }: { s: ReviewSuggestion; due: string }) {
  const [added, setAdded] = useState(false);
  const toTask = async () => {
    await run("post", "/tasks", { title: s.task_title, due_date: due }, { ok: m.review.taskAdded(fmtDay(due)) });
    setAdded(true);
  };
  return (
    <div className="rev-row">
      <span className="rev-row-text">{s.text}</span>
      <button type="button" className="rev-btn" disabled={added} onClick={() => void toTask().catch(() => {})}>
        {added ? m.review.taskDone : m.review.toTask}
      </button>
    </div>
  );
}

function Suggestions({ r }: { r: WeeklyReview }) {
  return (
    <Card label={m.review.suggestions} className="rep-card rep-flush rise" style={order(3)}>
      <SectionHead title={m.review.suggestions}>
        <span className="rep-aside">{m.review.taskDue(fmtDay(r.next_monday))}</span>
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
    <div className="ff-seg rev-nav" role="group" aria-label={m.review.week}>
      <button type="button" aria-label={m.review.previousWeek} onClick={() => setWeek(r.prev_week)}>
        <Icon name="arrow" className="size-icon-md rotate-180" />{m.review.previous}
      </button>
      <button type="button" aria-pressed={r.current} onClick={() => setWeek(null)}>{m.review.thisWeek}</button>
      <button type="button" aria-label={m.review.nextWeek} disabled={!r.next_week} onClick={() => setWeek(r.next_week)}>
        {m.review.next}<Icon name="arrow" className="size-icon-md" />
      </button>
    </div>
  ) : null;

  return (
    <Page title={m.review.title} sub={r ? m.review.sub(Number(r.week.slice(-2)), fmtDay(r.start), fmtDay(r.end), r.current) : ""} right={nav} width="narrow">
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
