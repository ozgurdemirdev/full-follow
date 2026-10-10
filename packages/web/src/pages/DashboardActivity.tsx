// Dashboard üst bölümü: Günlük / Haftalık / Aylık filtre, özet kutuları ve hafif grafikler (div çubuklar, sadece token)
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "../api/store";
import type { Today as TodayData } from "../api/types";
import { PATHS } from "../app/routes";
import { order, Segmented } from "../components/ui";
import { fmtDay, fmtMonthShort, pct } from "../lib/format";
import { CHANNEL_DOT, CONTACT_STATUS, STATUS_DOT } from "../lib/labels";
import { channelName } from "../lib/network";

type Period = "day" | "week" | "month";
const PERIODS: { key: Period; label: string; now: string; prev: string }[] = [
  { key: "day", label: "Günlük", now: "Bugün", prev: "dün" },
  { key: "week", label: "Haftalık", now: "Bu hafta", prev: "geçen hafta" },
  { key: "month", label: "Aylık", now: "Bu ay", prev: "geçen ay" },
];
/** Dilim sayısına göre ızgara (Tailwind sınıfı derlemede taransın diye tam ad) */
const COLS: Record<number, string> = { 14: "grid-cols-14", 8: "grid-cols-8", 6: "grid-cols-6" };
const KEY = "ff.dashboard.period";

interface Bucket {
  start: string;
  end: string;
  sent: number;
  replies: number;
  meetings: number;
  new_people: number;
  new_companies: number;
}
interface Activity {
  period: Period;
  buckets: Bucket[];
  current: Bucket;
  previous: Bucket | null;
  channels: { channel: string; sent: number; replies: number }[];
  status: Record<"people" | "companies", { status: string; count: number }[]>;
}

const savedPeriod = (): number => {
  try {
    return Math.max(0, PERIODS.findIndex((p) => p.key === localStorage.getItem(KEY)));
  } catch {
    return 1;
  }
};

export function DashboardActivity({ d }: { d: TodayData }) {
  const [i, setI] = useState(savedPeriod);
  const period = PERIODS[i];
  const pick = (k: number) => {
    setI(k);
    try {
      localStorage.setItem(KEY, PERIODS[k].key);
    } catch {
      /* gizli pencere */
    }
  };
  const a = useQuery<Activity>(`/stats/activity?period=${period.key}`);
  const cur = a.data?.current;
  const prev = a.data?.previous;
  const target = d.network.settings.weekly_target;
  const late = d.network.awaiting.rows.filter((p) => p.awaiting?.late).length;
  const diff = (k: keyof Bucket) => (cur && prev ? (cur[k] as number) - (prev[k] as number) : 0);
  const delta = (k: keyof Bucket) => {
    const n = diff(k);
    return n === 0 ? `${period.prev} kadar` : `${period.prev}den ${Math.abs(n)} ${n > 0 ? "fazla" : "az"}`;
  };
  const cards = cur ? [
    period.key === "week" && target
      ? { label: "Giden mesaj", value: `${cur.sent}/${target}`, note: cur.sent >= target ? "hedef tamam" : `hedefe ${target - cur.sent} kaldı`, tone: cur.sent >= target ? "text-status-text-success" : "text-status-text-attention" }
      : { label: "Giden mesaj", value: cur.sent, note: delta("sent"), tone: diff("sent") > 0 ? "text-status-text-success" : "text-text-secondary" },
    { label: "Dönüş alınan", value: cur.replies, note: cur.sent ? `${pct(cur.replies / cur.sent)} dönüş` : delta("replies"), tone: "text-text-secondary" },
    { label: "Cevap bekleyen", value: d.network.awaiting.total, note: late ? `${late} kişi ${d.network.settings.reply_wait_days}+ gündür` : "şu an", tone: "text-status-text-attention" },
    { label: "Yeni kayıt", value: cur.new_people + cur.new_companies, note: `${cur.new_people} kişi · ${cur.new_companies} firma${cur.meetings ? ` · ${cur.meetings} görüşme` : ""}`, tone: "text-text-secondary" },
  ] : [];

  return (
    <section className="flex flex-col gap-5" aria-label="Network özeti">
      <div className="flex flex-wrap items-center gap-4">
        <Segmented label="Dönem" items={PERIODS.map((p) => p.label)} value={i} onChange={pick} />
        <span className="text-base-sm text-text-secondary">{period.now}{cur ? ` · ${fmtDay(cur.start)}${cur.end !== cur.start ? ` – ${fmtDay(cur.end)}` : ""}` : ""}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 desk:grid-cols-4 desk:gap-5">
        {cards.map((c, k) => (
          <div key={c.label} className="card rise flex flex-col gap-2 p-7" style={order(k + 1)}>
            <span className="text-base-sm text-text-secondary">{c.label}</span>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="kpi">{c.value}</span>
              {c.note ? <span className={`text-sm ${c.tone}`}>{c.note}</span> : null}
            </div>
          </div>
        ))}
      </div>
      {a.data ? (
        <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-9">
          <TouchChart a={a.data} />
          <StatusCard a={a.data} />
        </div>
      ) : null}
    </section>
  );
}

// günlükte sadece ayın günü (14 dar sütuna sığsın)
const bucketLabel = (b: Bucket, p: Period) => (p === "month" ? fmtMonthShort(b.start.slice(0, 7)) : p === "day" ? String(Number(b.start.slice(8))) : fmtDay(b.start));

/** Giden ve gelen mesaj çubukları (dilim başına iki çubuk) */
function TouchChart({ a }: { a: Activity }) {
  const max = Math.max(1, ...a.buckets.flatMap((b) => [b.sent, b.replies]));
  const cols = COLS[a.buckets.length] ?? "grid-cols-8";
  const step = a.buckets.length > 8 ? 2 : 1;
  return (
    <section className="card rise flex flex-col gap-6 p-8" style={order(5)} aria-label="Temas grafiği">
      <div className="flex flex-wrap items-baseline gap-5">
        <h2 className="m-0 flex-grow text-md font-semibold">Temaslar</h2>
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary"><span className="dot bg-accent-opportunity" />Giden</span>
        <span className="inline-flex items-center gap-2 text-sm text-text-secondary"><span className="dot bg-primary" />Dönüş</span>
      </div>
      <div className={`grid h-chart-height-mobile items-end gap-2 border-b border-border-default desk:h-chart-height desk:gap-3 ${cols}`}>
        {a.buckets.map((b, k) => (
          <div key={b.start} className="flex h-full items-end justify-center gap-0.5" title={`${bucketLabel(b, a.period)}: ${b.sent} giden, ${b.replies} dönüş`}
            aria-label={`${bucketLabel(b, a.period)}: ${b.sent} giden, ${b.replies} dönüş`}>
            <div className="grow-y w-full rounded-t-sm bg-accent-opportunity" style={{ height: `${(b.sent / max) * 100}%`, ...order(k) }} />
            <div className="grow-y w-full rounded-t-sm bg-primary" style={{ height: `${(b.replies / max) * 100}%`, ...order(k) }} />
          </div>
        ))}
      </div>
      <div className={`grid gap-2 text-center text-xs text-text-muted desk:gap-3 ${cols}`}>
        {a.buckets.map((b, k) => <span key={b.start} className="truncate">{k % step === (a.buckets.length - 1) % step ? bucketLabel(b, a.period) : ""}</span>)}
      </div>
      {a.channels.length ? (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
          {a.channels.map((c) => (
            <span key={c.channel} className="inline-flex items-center gap-2">
              <span className={`dot ${CHANNEL_DOT[c.channel] ?? "bg-accent-neutral"}`} />
              {channelName(c.channel)} {c.sent} giden{c.replies ? `, ${c.replies} dönüş` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Firmaların ve kişilerin temas durumu: yığılmış yatay çubuk + adetler (filtreli listeye bağlantı) */
function StatusCard({ a }: { a: Activity }) {
  const rows = [
    { key: "companies" as const, label: "Firmalar", href: PATHS.companies },
    { key: "people" as const, label: "Kişiler", href: PATHS.people },
  ];
  return (
    <section className="card rise flex flex-col gap-6 p-8" style={order(6)} aria-label="Temas durumu">
      <h2 className="m-0 text-md font-semibold">Temas durumu</h2>
      {rows.map((r) => {
        const list = a.status[r.key];
        const total = list.reduce((s, x) => s + x.count, 0);
        return (
          <Link key={r.key} href={r.href} className="flex flex-col gap-3 text-text-primary hover:text-text-primary">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base-sm font-medium">{r.label}</span>
              <span className="text-sm text-text-secondary">{total}</span>
            </div>
            <div className="flex h-bar overflow-hidden rounded-pill bg-surface-track-alt">
              {total ? list.filter((x) => x.count).map((x) => (
                <div key={x.status} className={`grow-x h-bar ${STATUS_DOT[x.status]}`} style={{ width: `${(x.count / total) * 100}%` }} title={`${CONTACT_STATUS[x.status]}: ${x.count}`} />
              )) : null}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
              {list.filter((x) => x.count).map((x) => (
                <span key={x.status} className="inline-flex items-center gap-2"><span className={`dot ${STATUS_DOT[x.status]}`} />{CONTACT_STATUS[x.status]} {x.count}</span>
              ))}
              {!total ? <span className="text-text-muted">Henüz kayıt yok</span> : null}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
