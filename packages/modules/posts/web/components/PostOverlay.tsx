import type { ReactNode } from "react";
import { remove } from "@kit/api/actions";
import type { Person, Post } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { fmtDay } from "@kit/lib/format";
import { POST_FORMAT } from "../labels";
import { refreshNote } from "../marketing";
import { BoardIcon } from "@kit/components/boardIcons";
import { Section } from "@kit/components/contact";
import { ExpandOverlay } from "@kit/components/ExpandOverlay";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { Chip, Who } from "@kit/components/ui";
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
        {p.idea_title && p.idea_id ? <Fact label="Fikir"><RecordLink type="idea" id={p.idea_id}>{p.idea_title}</RecordLink></Fact> : null}
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
            <Slot name="post.overlay.side" props={{ post: p, people }} />
          </div>
        </>
      ) : null}
    </ExpandOverlay>
  );
}
