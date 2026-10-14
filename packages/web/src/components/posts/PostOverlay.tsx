import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { remove } from "../../api/actions";
import { useOpps } from "../../api/keys";
import type { Person, Post } from "../../api/types";
import { opportunityPath, PATHS } from "../../app/routes";
import { openSheet } from "../../app/ui";
import { fmtDay, lira } from "../../lib/format";
import { POST_FORMAT, STAGE, STAGE_TONE } from "../../lib/labels";
import { refreshNote } from "../../lib/marketing";
import { oppsOf } from "../../lib/posts";
import { BoardIcon } from "../boardIcons";
import { Section } from "../contact";
import { ExpandOverlay } from "../ExpandOverlay";
import { Avatar, Chip, Who } from "../ui";
import { PlatformPill, useRefresh } from "./PlatformPill";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="posts-fact"><span>{label}</span><span>{children}</span></div>;
}

function Facts({ p }: { p: Post }) {
  const note = refreshNote(p);
  return (
    <div className="ppl-panel">
      <Section title="Paylaşım">
        {p.format ? <Fact label="Biçim">{POST_FORMAT[p.format]}</Fact> : null}
        <Fact label="Paylaşım tarihi">{fmtDay(p.posted_at)}</Fact>
        <Fact label="Hatırlatma"><span className={note.late ? "text-warning" : ""}>{note.text}</span></Fact>
        <Fact label="Aralık">{p.refresh_every} günde bir{p.refresh_days ? "" : " (varsayılan)"}</Fact>
        <Fact label="Ekleyen"><Who actor={p.created_by} /></Fact>
        {p.url ? <Fact label="Bağlantı"><a href={p.url} target="_blank" rel="noreferrer">Paylaşımı aç</a></Fact> : null}
        {p.idea_title && p.idea_id ? <Fact label="Fikir"><Link href={`${PATHS.ideas}/${p.idea_id}`}>{p.idea_title}</Link></Fact> : null}
      </Section>
    </div>
  );
}

function Texts({ p }: { p: Post }) {
  if (!p.body && !p.notes) return null;
  return (
    <div className="ppl-panel">
      {p.body ? <Section title="Metin"><p className="m-0 whitespace-pre-wrap text-base-sm text-text-primary">{p.body}</p></Section> : null}
      {p.notes ? <Section title="Notlar"><p className="m-0 whitespace-pre-wrap text-base-sm text-text-secondary">{p.notes}</p></Section> : null}
    </div>
  );
}

function PeopleList({ people }: { people: Person[] }) {
  return (
    <div className="ppl-panel">
      <Section title={`Kişiler · ${people.length}`}>
        {people.length ? people.map((x) => (
          <Link key={x.id} href={`${PATHS.people}/${x.id}`} className="posts-link-row">
            <Avatar name={x.name} id={x.id} size="sm" />
            <span className="min-w-0 flex-grow truncate text-base">{x.name}</span>
            {x.company_name ? <span className="truncate text-base-sm text-text-muted">{x.company_name}</span> : null}
          </Link>
        )) : <span className="text-base-sm text-text-muted">Bu paylaşımdan kimse gelmedi</span>}
      </Section>
    </div>
  );
}

function OppList({ p, people }: { p: Post; people: Person[] }) {
  const opps = useOpps(people.length > 0);
  const list = useMemo(() => oppsOf(opps.rows, people), [opps.rows, people]);
  return (
    <div className="ppl-panel">
      <Section title={`Fırsatlar · ${p.opp_count}`} right={p.won ? <Chip tone="success">{p.won} kazanıldı · {lira(p.won_value)}</Chip> : undefined}>
        {list.length ? list.map((o) => (
          <Link key={o.id} href={opportunityPath(o.id)} className="posts-link-row">
            <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
            {o.estimated_value ? <span className="font-mono text-base-sm text-text-secondary">{lira(o.estimated_value)}</span> : null}
            <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
          </Link>
        )) : <span className="text-base-sm text-text-muted">{p.opp_count ? "Yükleniyor" : "Henüz fırsat yok"}</span>}
      </Section>
    </div>
  );
}

/** A post as a dialog: header with the actions (refresh, edit, delete), facts and texts on the left, its people and opportunities on the right */
export function PostOverlay({ id, from, p, people, onClose }: { id: number | null; from: DOMRect | null; p: Post | undefined; people: Person[]; onClose: () => void }) {
  const { busy, refresh } = useRefresh(p?.id);
  const del = () => {
    if (p) void remove(`/posts/${p.id}`, `“${p.title}” paylaşımı`).then(onClose).catch(() => {});
  };
  return (
    <ExpandOverlay
      open={!!id && !!p}
      from={from}
      title={p?.title ?? "Paylaşım"}
      onClose={onClose}
      bodyClassName="ppl-body"
      header={p ? (
        <>
          <div className="posts-ov-head">
            <div className="posts-ov-title">
              <PlatformPill platform={p.platform} size="lg" />
              <h2>{p.url ? <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</h2>
              {p.refresh_due ? <Chip tone="warning">Güncelle</Chip> : null}
            </div>
            <span className="text-base text-text-secondary">
              {fmtDay(p.posted_at)} · <span className={refreshNote(p).late ? "text-warning" : ""}>{refreshNote(p).text}</span>
            </span>
          </div>
          <div className="posts-ov-actions">
            <button type="button" className="posts-act" data-tone="warn" disabled={busy} onClick={refresh}>
              <BoardIcon name="check" className="size-icon-chip" stroke={2.2} />
              Güncelledim
            </button>
            <button type="button" className="posts-act" data-tone="plain" onClick={() => openSheet("post", { post_id: p.id })}>Düzenle</button>
            <button type="button" className="posts-act" data-tone="plain" data-danger onClick={del}>Sil</button>
            <button type="button" className="ppl-round" data-close aria-label="Kapat" onClick={onClose}>
              <BoardIcon name="close" className="size-icon-md" stroke={2} />
            </button>
          </div>
        </>
      ) : null}
    >
      {p ? (
        <>
          <div className="ppl-col">
            <Facts p={p} />
            <Texts p={p} />
          </div>
          <div className="ppl-col min-w-0">
            <PeopleList people={people} />
            <OppList p={p} people={people} />
          </div>
        </>
      ) : null}
    </ExpandOverlay>
  );
}
