// Cards the board leaves out but the dashboard keeps: daily quota, Friday review, posts to refresh, follow-ups due
import { useState } from "react";
import { Link } from "wouter";
import { run } from "../../api/actions";
import type { FollowupDue, List, Post, Quota, QuotaState } from "../../api/types";
import { useRegistry } from "../../app/modules/registry";
import { PATHS } from "../../app/routes";
import { SHOWN } from "../../lib/dashboard";
import { fmtDay, initials } from "../../lib/format";
import { CHANNEL_DOT, PLATFORM, PLATFORM_DOT } from "../../lib/labels";
import { refreshNote } from "../../lib/marketing";
import { channelName } from "../../lib/network";
import { BoardIcon } from "../boardIcons";
import { Card, MoreLink, Meter } from "../ui";

const PERCENT = 100;

/** Bar colour and count colour per quota state: muted while fine, warning when close, danger when the limit is reached */
const QUOTA_TONE: Record<QuotaState, { bar: string; text: string }> = {
  ok: { bar: "bg-border-strong", text: "text-text-secondary" },
  near: { bar: "bg-warning", text: "text-warning" },
  over: { bar: "bg-danger", text: "text-danger" },
};
const QUOTA_NOTE: Partial<Record<QuotaState, string>> = { near: "limite yakın", over: "limit doldu" };

/** Messages sent today against each channel's daily limit, plus the cold email warmup notice */
export function QuotaCard({ quota }: { quota: Quota }) {
  const { channels, email_warmup: warmup } = quota;
  return (
    <Card title="Günlük kota" className="dash-gap-6 rise" actions={<span className="text-base-sm text-text-secondary">giden mesaj / limit</span>}>
      {channels.map((c) => {
        const tone = QUOTA_TONE[c.state];
        return (
          <div key={c.channel} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4 text-base">
              <span className="truncate">{channelName(c.channel)}</span>
              <span className={`flex-none font-mono text-sm ${tone.text}`}>
                {QUOTA_NOTE[c.state] ? <span className="mr-3 font-sans">{QUOTA_NOTE[c.state]}</span> : null}
                {c.sent} / {c.limit}
              </span>
            </div>
            <Meter value={(c.sent / c.limit) * PERCENT} size="sm" color={tone.bar} label={`${channelName(c.channel)} günlük kota`} />
          </div>
        );
      })}
      {warmup.active && warmup.until ? <p className="m-0 text-base-sm text-warning">Soğuk e-posta kapalı: ısınma dönemi {fmtDay(warmup.until)} tarihine kadar sürüyor.</p> : null}
    </Card>
  );
}

/** Shown on Fridays: the weekly review of the current week is ready */
export function ReviewCard() {
  return (
    <Card label="Cuma incelemesi" className="rise">
      <Link href={PATHS.review} className="dash-row flex items-center gap-5 text-text-primary hover:text-text-primary" aria-label="Cuma incelemesi hazır, haftalık inceleme sayfasına git">
        <BoardIcon name="review" className="size-icon-xl flex-none text-accent" />
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="text-md">Cuma incelemesi hazır</span>
          <span className="text-sm text-text-secondary">Bu haftanın sayıları ve gelecek hafta için öneriler</span>
        </span>
        <BoardIcon name="arrowRight" className="size-icon-md flex-none text-text-muted" />
      </Link>
    </Card>
  );
}

/** Posts whose refresh date has come */
export function PostsDueCard({ list }: { list: List<Post> }) {
  const refresh = (p: Post) => run("post", `/posts/${p.id}/refresh`, undefined, { ok: "Güncellendi olarak işaretlendi" }).catch(() => {});
  return (
    <Card title="Güncellenecek paylaşımlar" className="dash-gap-4 dash-head-pad rise" actions={<MoreLink href={PATHS.posts}>Hepsi</MoreLink>}>
      {list.rows.slice(0, SHOWN.posts).map((p) => (
        <div key={p.id} className="flex items-center gap-5 border-t border-border-subtle py-4">
          <span className={`dash-dot ${PLATFORM_DOT[p.platform] ?? "bg-entity-neutral"}`} />
          <div className="flex min-w-0 flex-grow flex-col">
            {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-base text-text-primary">{p.title}</a> : <span className="truncate text-base">{p.title}</span>}
            <span className="text-sm text-warning">{PLATFORM[p.platform]} · {refreshNote(p)?.text}</span>
          </div>
          <button type="button" className="dash-btn is-small flex-none" onClick={() => refresh(p)}>Güncelledim</button>
        </div>
      ))}
    </Card>
  );
}

/** Follow-up messages due in the marketing sequence, and the button that makes their drafts */
export function FollowupsDueCard({ list }: { list: List<FollowupDue> }) {
  const reg = useRegistry();
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      await run("post", "/followups/run", undefined, { ok: "Takip taslakları onaya düştü" });
    } catch {
      /* the notice is shown by run() */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Takip zamanı" className="dash-gap-4 dash-head-pad rise"
      actions={<button type="button" className="dash-btn is-claude is-small" disabled={busy} onClick={make}>Şimdi hazırla</button>}>
      {list.rows.slice(0, SHOWN.followups).map((f) => (
        <Link key={`${f.person_id}-${f.contact}`} href={(f.person_id ? reg.link("person", f.person_id) : reg.pagePath("people")) ?? PATHS.today}
          className="dash-row flex items-center gap-5 border-t border-border-subtle py-4 text-text-primary hover:text-text-primary">
          <span className="dash-av size-avatar-list text-sm">{initials(f.name)}</span>
          <span className="flex min-w-0 flex-grow flex-col">
            <span className="truncate text-base">{f.name}{f.company_name ? <span className="text-text-secondary"> · {f.company_name}</span> : null}</span>
            <span className="flex items-center gap-2 text-sm text-warning"><span className={`dash-dot ${CHANNEL_DOT[f.channel] ?? "bg-entity-neutral"}`} />{f.days} gündür cevap yok · {channelName(f.channel)}</span>
          </span>
          <span className="dash-chip is-lg bg-claude-bg text-claude-soft">{f.step}. takip</span>
        </Link>
      ))}
    </Card>
  );
}

