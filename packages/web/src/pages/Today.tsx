import { useMemo, useState } from "react";
import { Link } from "wouter";
import { remove, run } from "../api/actions";
import { K, useBoard, usePeople, useThreads } from "../api/keys";
import { mutate, useQuery } from "../api/store";
import type { Draft, FollowupDue, List, Person, Post, Task, Today as TodayData } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { GlobalSearch } from "../app/Search";
import { Icon } from "../components/icons";
import { Avatar, CardHead, Chip, ErrorBox, order, PageSkeleton, Who } from "../components/ui";
import { ago, fmtDay, fmtToday, followNote, tl, todayIso } from "../lib/format";
import { BOARD_STAGES, CHANNEL, CHANNEL_DOT, MILESTONE, STAGE, STAGE_BG, TARGET } from "../lib/labels";
import { channelName, netStatus } from "../lib/network";
import { PLATFORM, PLATFORM_DOT } from "../lib/labels";
import { refreshNote } from "../lib/marketing";
import { openSheet } from "../app/ui";
import { DashboardActivity } from "./DashboardActivity";
import { EditDelete } from "../components/contact";

export default function Today() {
  const today = useQuery<TodayData>(K.today);
  const d = today.data;
  const sub = d
    ? `${fmtToday(d.date)} · ${d.network.awaiting.total} kişiden cevap bekleniyor, ${d.follow_ups.people.total + d.follow_ups.opportunities.total} takip ve ${d.drafts.total} taslak seni bekliyor`
    : "";

  return (
    <Page title="Dashboard" sub={sub} right={<GlobalSearch />} className="flex flex-col gap-7 desk:gap-9">
      {today.error && !d ? <ErrorBox error={today.error} retry={today.reload} /> : null}
      {!d ? (
        !today.error && <PageSkeleton />
      ) : (
        <>
          <DashboardActivity d={d} />
          <div className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] desk:gap-9">
            <div className="flex flex-col gap-7 desk:gap-9">
              <Awaiting list={d.network.awaiting} wait={d.network.settings.reply_wait_days} />
              <Followups list={d.followups} />
              <Drafts list={d.drafts} />
              <FollowUps data={d} />
            </div>
            <div className="flex flex-col gap-7 desk:gap-9">
              <PostsDue list={d.posts_due} />
              <Cooling list={d.network.cooling} days={d.network.settings.cooling_days} />
              <Tasks list={d.tasks} />
              <Comments />
              <Payments data={d} />
            </div>
          </div>
          <Funnel />
        </>
      )}
    </Page>
  );
}

// ------------------------------------------------------------ network: cevap bekleyen ve soğuyan
function PersonLine({ p, note, late }: { p: Person; note: string; late: boolean }) {
  const ch = p.awaiting?.channel ?? p.last_channel;
  return (
    <Link href={`${PATHS.people}/${p.id}`} className="row flex items-center gap-5 px-9 py-5 text-text-primary hover:text-text-primary">
      <Avatar name={p.name} />
      <div className="flex min-w-0 flex-grow flex-col gap-0.5">
        <span className="truncate text-base font-medium">
          {p.name} {p.company_name || p.sector_path ? <span className="font-normal text-text-secondary">· {p.company_name ?? p.sector_path}</span> : null}
        </span>
        <span className={`flex items-center gap-2 text-base-sm ${late ? "text-status-text-attention" : "text-text-secondary"}`}>
          {ch ? <span className={`dot ${CHANNEL_DOT[ch] ?? "bg-accent-neutral"}`} /> : null}
          {note}
        </span>
      </div>
      <Who actor={p.created_by} />
    </Link>
  );
}

function Awaiting({ list, wait }: { list: List<Person>; wait: number }) {
  return (
    <section className="card rise overflow-hidden" style={order(2)} aria-label="Cevap bekleyenler">
      <CardHead title="Cevap bekleyenler">
        <span className="text-sm text-text-secondary">{wait} gün geçen öne çıkar</span>
      </CardHead>
      {list.rows.length === 0 ? <p className="empty">Cevap beklenen mesaj yok. Yeni kişilere yazma zamanı.</p> : null}
      {list.rows.slice(0, 8).map((p) => {
        const st = netStatus(p);
        return <PersonLine key={p.id} p={p} note={st?.text.replace("Cevap bekliyor · ", "") ?? ""} late={!!p.awaiting?.late} />;
      })}
      {list.total > 8 ? <Link href={PATHS.people} className="block px-9 py-5 text-base-sm">Tümü ({list.total})</Link> : null}
    </section>
  );
}

function Cooling({ list, days }: { list: List<Person>; days: number }) {
  if (!list.rows.length) return null;
  return (
    <section className="card rise overflow-hidden" style={order(2)} aria-label="Soğuyan bağlantılar">
      <CardHead title="Soğuyan bağlantılar">
        <span className="text-sm text-text-secondary">{days}+ gün sessiz</span>
      </CardHead>
      {list.rows.slice(0, 5).map((p) => (
        <PersonLine key={p.id} p={p} note={`${p.days_since} gündür temas yok${p.last_channel ? ` · son ${channelName(p.last_channel)}` : ""}`} late={false} />
      ))}
      {list.total > 5 ? <Link href={PATHS.people} className="block px-9 py-5 text-base-sm">Tümü ({list.total})</Link> : null}
    </section>
  );
}

function Funnel() {
  const board = useBoard();
  const { cols, sources } = useMemo(() => {
    const count = new Map<string, number>();
    const src = new Map<string, number>();
    for (const o of board.rows) {
      count.set(o.stage, (count.get(o.stage) ?? 0) + 1);
      if (o.stage !== "kazanildi") src.set(o.source_name, (src.get(o.source_name) ?? 0) + 1);
    }
    const max = Math.max(1, ...count.values());
    return {
      cols: BOARD_STAGES.map((s) => ({ s, n: count.get(s) ?? 0, w: ((count.get(s) ?? 0) / max) * 100 })),
      sources: [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    };
  }, [board.rows]);

  return (
    <section className="card rise flex flex-col gap-6 px-9 py-8" style={order(6)} aria-label="Satış hunisi">
      <div className="flex flex-wrap items-baseline justify-between gap-5">
        <h2 className="m-0 text-md font-semibold">Satış hunisi</h2>
        {sources.length ? <span className="text-sm text-text-secondary">Kaynak: {sources.map(([n, c]) => `${n} ${c}`).join(" · ")}</span> : null}
      </div>
      <Link href={PATHS.pipeline} className="grid grid-cols-3 gap-5 text-text-primary hover:text-text-primary desk:grid-cols-6">
        {cols.map((c) => (
          <div key={c.s} className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-sm text-text-secondary">{STAGE[c.s]}</span>
            <span className="text-xl font-semibold tracking-title">{c.n}</span>
            <div className="h-bar rounded-pill bg-surface-track-alt">
              <div className={`grow-x h-bar rounded-pill ${STAGE_BG[c.s]}`} style={{ width: `${c.w}%` }} />
            </div>
          </div>
        ))}
      </Link>
    </section>
  );
}

// ------------------------------------------------------------ pazarlama: takip dizisi ve paylaşımlar
function Followups({ list }: { list: List<FollowupDue> }) {
  const [busy, setBusy] = useState(false);
  if (!list.total) return null;
  const make = async () => {
    setBusy(true);
    try {
      await run("post", "/followups/run", undefined, { ok: "Takip taslakları onaya düştü" });
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card rise overflow-hidden" style={order(2)} aria-label="Takip zamanı gelenler">
      <CardHead title="Takip zamanı">
        <button type="button" className="btn btn-sec btn-sm" disabled={busy} onClick={make}>Taslakları hazırla</button>
      </CardHead>
      {list.rows.slice(0, 6).map((f) => (
        <Link key={f.person_id} href={`${PATHS.people}/${f.person_id}`} className="row flex items-center gap-5 px-9 py-5 text-text-primary hover:text-text-primary">
          <Avatar name={f.name} />
          <div className="flex min-w-0 flex-grow flex-col gap-0.5">
            <span className="truncate text-base font-medium">{f.name} {f.company_name ? <span className="font-normal text-text-secondary">· {f.company_name}</span> : null}</span>
            <span className="flex items-center gap-2 text-base-sm text-status-text-attention">
              <span className={`dot ${CHANNEL_DOT[f.channel] ?? "bg-accent-neutral"}`} />
              {f.days} gündür cevap yok · {channelName(f.channel)}
            </span>
          </div>
          <Chip tone="claude">{f.step}. takip</Chip>
        </Link>
      ))}
    </section>
  );
}

function PostsDue({ list }: { list: List<Post> }) {
  if (!list.total) return null;
  const refresh = (p: Post) => run("post", `/posts/${p.id}/refresh`, undefined, { ok: "Güncellendi olarak işaretlendi" }).catch(() => {});
  return (
    <section className="card rise overflow-hidden" style={order(2)} aria-label="Güncellenecek paylaşımlar">
      <CardHead title="Güncellenecek paylaşımlar">
        <Link href={PATHS.posts} className="text-base-sm">Hepsi</Link>
      </CardHead>
      {list.rows.slice(0, 5).map((p) => (
        <div key={p.id} className="row flex items-center gap-5 px-9 py-5">
          <span className={`dot ${PLATFORM_DOT[p.platform] ?? "bg-accent-neutral"}`} />
          <div className="flex min-w-0 flex-grow flex-col gap-0.5">
            {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-base font-medium text-text-primary">{p.title}</a> : <span className="truncate text-base font-medium">{p.title}</span>}
            <span className="text-base-sm text-status-text-attention">{PLATFORM[p.platform]} · {refreshNote(p)?.text}</span>
          </div>
          <Who actor={p.created_by} />
          <button type="button" className="btn btn-sec btn-sm" onClick={() => refresh(p)}>Güncelledim</button>
        </div>
      ))}
    </section>
  );
}

// ------------------------------------------------------------ taslaklar
function Drafts({ list }: { list: List<Draft> }) {
  const people = usePeople();
  const board = useBoard();
  const [sent, setSent] = useState<Set<number>>(new Set());

  const send = async (d: Draft) => {
    setSent((s) => new Set(s).add(d.id));
    try {
      await run("post", `/drafts/${d.id}/send`, undefined, { ok: "Temas olarak kaydedildi" });
    } catch {
      setSent((s) => {
        const n = new Set(s);
        n.delete(d.id);
        return n;
      });
    }
  };

  return (
    <section className="card rise overflow-hidden" style={order(3)} aria-label="Onay bekleyen taslaklar">
      <CardHead title="Onay bekleyen taslaklar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("draft")}>Taslak yaz</button>
      </CardHead>
      {list.rows.length === 0 ? <p className="empty">Onay bekleyen taslak yok.</p> : null}
      {list.rows.slice(0, 4).map((d) => {
        const person = d.person_id ? people.byId.get(d.person_id) : undefined;
        const opp = d.opportunity_id ? board.byId.get(d.opportunity_id) : undefined;
        const isSent = sent.has(d.id);
        return (
          <article key={d.id} className={`row flex flex-col gap-4 px-9 py-7 transition-opacity dur-segment ${isSent ? "opacity-muted" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-semibold">{d.to_name}</span>
              {person?.company_name ? <span className="text-base-sm text-text-secondary">{person.company_name}</span> : null}
              <span className="flex-grow" />
              {opp ? <Chip tone="source">{opp.source_name}</Chip> : null}
              {d.followup_step ? <Chip tone="claude">{d.followup_step}. takip</Chip> : null}
              <Who actor={d.created_by} />
              <Chip>{CHANNEL[d.channel] ?? d.channel}</Chip>
            </div>
            <p className="m-0 whitespace-pre-line text-base leading-relaxed text-text-body">{d.body}</p>
            {d.reason ? <p className="m-0 text-sm text-text-secondary"><span className="text-author-claude-fg">Neden: </span>{d.reason}</p> : null}
            {isSent ? (
              <div className="flex items-center gap-2 text-base-sm text-status-text-success">
                <Icon name="check" className="size-icon-md" stroke={2} />
                Temas olarak kaydedildi
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn btn-pri" onClick={() => send(d)}>Onayla, gönderdim</button>
                <Link href={PATHS.drafts} className="btn btn-sec">Düzenle</Link>
              </div>
            )}
          </article>
        );
      })}
      {list.total > 4 ? (
        <Link href={PATHS.drafts} className="block px-9 py-5 text-base-sm">Tüm taslaklar ({list.total})</Link>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------ takip
function FollowUps({ data }: { data: TodayData }) {
  const items = useMemo(() => {
    const seen = new Set<number>();
    const out: { key: string; name: string; org: string | null; note: ReturnType<typeof followNote>; stage?: string; href: string }[] = [];
    for (const o of data.follow_ups.opportunities.rows) {
      seen.add(o.person_id);
      out.push({ key: `o${o.id}`, name: o.person_name, org: o.title, note: followNote(o.next_follow_up_at), stage: STAGE[o.stage], href: timelinePath("opportunity", o.id) });
    }
    for (const p of data.follow_ups.people.rows) {
      if (seen.has(p.id)) continue;
      out.push({ key: `p${p.id}`, name: p.name, org: p.company_name, note: followNote(p.next_follow_up_at), href: timelinePath("person", p.id) });
    }
    return out;
  }, [data]);

  return (
    <section className="card rise overflow-hidden" style={order(4)} aria-label="Takibi gelenler">
      <CardHead title="Takibi gelenler">
        <Link href={PATHS.people} className="text-base-sm">Hepsi</Link>
      </CardHead>
      {items.length === 0 ? <p className="empty">Bugün takibi gelen kimse yok.</p> : null}
      {items.map((it) => (
        <Link key={it.key} href={it.href} className="row flex items-center gap-5 px-9 py-5 text-text-primary hover:text-text-primary">
          <Avatar name={it.name} />
          <div className="flex min-w-0 flex-grow flex-col gap-0.5">
            <span className="truncate text-base font-medium">
              {it.name} {it.org ? <span className="font-normal text-text-secondary">· {it.org}</span> : null}
            </span>
            {it.note ? <span className={`text-base-sm ${it.note.late ? "text-status-text-attention" : "text-text-secondary"}`}>{it.note.text}</span> : null}
          </div>
          {it.stage ? <Chip tone="opportunity">{it.stage}</Chip> : null}
        </Link>
      ))}
    </section>
  );
}

// ------------------------------------------------------------ görevler
function Tasks({ list }: { list: List<Task> }) {
  const toggle = async (t: Task) => {
    const done = !t.done_at;
    const flip = (prev?: TodayData) =>
      prev && { ...prev, tasks: { ...prev.tasks, rows: prev.tasks.rows.map((x) => (x.id === t.id ? { ...x, done_at: done ? new Date().toISOString() : null } : x)) } };
    const before = mutate<TodayData>(K.today, flip);
    try {
      await run("patch", `/tasks/${t.id}`, { done }, { silent: true });
    } catch {
      mutate<TodayData>(K.today, () => before);
    }
  };
  const doneCount = list.rows.filter((t) => t.done_at).length;

  return (
    <section className="card rise overflow-hidden" style={order(3)} aria-label="Bugünkü görevler">
      <CardHead title="Bugünkü görevler">
        <span className="text-sm text-text-secondary">{doneCount} / {list.rows.length}</span>
      </CardHead>
      <div className="px-3 py-2">
        {list.rows.length === 0 ? <p className="empty">Bugün için görev yok.</p> : null}
        {list.rows.map((t) => {
          const late = t.due_date && t.due_date < todayIso();
          return (
            <div key={t.id} className="row flex items-center gap-5 rounded-xl border-0 px-5 py-4">
              <button type="button" role="checkbox" aria-checked={!!t.done_at} aria-label="Tamamlandı olarak işaretle" className="chk" onClick={() => toggle(t)}>
                <Icon name="check" className="size-icon-sm" stroke={3} />
              </button>
              <span className="flex min-w-0 flex-grow flex-col">
                <span className={`text-base transition-colors dur-fade ${t.done_at ? "text-text-disabled line-through" : ""}`}>{t.title}</span>
                {late && !t.done_at ? <span className="text-sm text-status-text-attention">{fmtDay(t.due_date)} tarihliydi</span> : null}
              </span>
              <Who actor={t.created_by} />
              <EditDelete label="Görev" onEdit={() => openSheet("task", { edit: t.id })} onDelete={() => void remove(`/tasks/${t.id}`, "Görev").catch(() => {})} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ------------------------------------------------------------ yorumlar
function Comments() {
  const threads = useThreads();
  const list = threads.rows.slice(0, 3);
  return (
    <section className="card rise overflow-hidden" style={order(4)} aria-label="Cevap bekleyen yorumlar">
      <CardHead title="Cevap bekleyen yorumlar">
        <Link href={PATHS.comments} className="text-base-sm">Hepsi</Link>
      </CardHead>
      {list.length === 0 ? <p className="empty">Açık yorum yok.</p> : null}
      {list.map((c) => (
        <Link key={c.id} href={PATHS.comments} className="row flex flex-col gap-3 px-9 py-6 text-text-primary hover:text-text-primary">
          <div className="flex flex-wrap items-center gap-3">
            <Who actor={c.last_by} />
            <span className="text-base-sm text-text-secondary">{TARGET[c.target_type]}: {c.target_label} · {ago(c.last_at)}</span>
          </div>
          <p className="m-0 line-clamp-3 text-base leading-normal">{c.last_body}</p>
          <Chip tone={c.last_by === "ozgur" ? "claude" : "warning"} className="self-start">
            {c.last_by === "ozgur" ? "Claude’un cevabı bekleniyor" : "Senin cevabın bekleniyor"}
          </Chip>
        </Link>
      ))}
    </section>
  );
}

// ------------------------------------------------------------ ödemeler
function Payments({ data }: { data: TodayData }) {
  if (!data.payments.rows.length) return null;
  return (
    <section className="card rise overflow-hidden" style={order(5)} aria-label="Beklenen ödemeler">
      {data.payments.rows.slice(0, 3).map((p) => (
        <Link key={p.id} href={timelinePath("project", p.project_id)} className="row flex items-center gap-5 px-9 py-7 text-text-primary hover:text-text-primary">
          <Chip tone={p.status === "gecikmis" ? "warning" : "payment"}>{p.status === "gecikmis" ? "Gecikti" : "Ödeme"}</Chip>
          <div className="flex min-w-0 flex-grow flex-col gap-0.5">
            <span className="truncate text-base font-medium">{p.project_name} · {MILESTONE[p.milestone]?.toLocaleLowerCase("tr-TR")}</span>
            <span className="text-base-sm text-text-secondary">{p.due_date ? `${fmtDay(p.due_date)} bekleniyor` : "tarih yok"}</span>
          </div>
          <span className="flex-none whitespace-nowrap font-mono text-base">{tl(p.expected_amount - p.paid_amount)}</span>
        </Link>
      ))}
    </section>
  );
}
