import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove as trash, run } from "../api/actions";
import { usePosts } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, Person, Post } from "../api/types";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { openSheet } from "../app/ui";
import { Icon } from "../components/icons";
import { Chip, Empty, ErrorBox, Filters, order, PageSkeleton, Who } from "../components/ui";
import { fmtDay, tl } from "../lib/format";
import { refreshNote } from "../lib/marketing";
import { PLATFORM, PLATFORM_DOT, PLATFORMS } from "../lib/labels";

// Paylaşımlar: R10 konuları, LinkedIn/Instagram gönderileri; ne zaman güncellenecek, kimi ve ne işi getirdi
export default function Posts() {
  const posts = usePosts();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [platform, setPlatform] = useState("");
  const [onlyDue, setOnlyDue] = useState(false);
  const rows = posts.rows;
  const due = rows.filter((p) => p.refresh_due).length;
  const people = rows.reduce((a, p) => a + p.people_count, 0);
  const won = rows.reduce((a, p) => a + p.won_value, 0);
  const shown = rows.filter((p) => (!platform || p.platform === platform) && (!onlyDue || p.refresh_due));
  const open = Number(params.id) || 0;

  return (
    <Page
      title="Paylaşımlar"
      sub={posts.data ? `${rows.length} paylaşım · ${due} güncellenecek · ${people} kişi getirdi${won ? ` · kazanılan ${tl(won)}` : ""}` : ""}
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("post")}>Paylaşım ekle</button>}
      width="narrow"
      className="flex flex-col gap-7"
    >
      {posts.error && !posts.data ? <ErrorBox error={posts.error} retry={posts.reload} /> : null}
      {!posts.data ? (
        !posts.error && <PageSkeleton />
      ) : (
        <>
          <div className="rise flex flex-wrap items-center gap-3">
            <Filters label="Platform" value={platform} onChange={setPlatform} items={[{ value: "", label: "Hepsi" }, ...PLATFORMS.map((x) => ({ value: x, label: PLATFORM[x] }))]} />
            <span className="flex-grow" />
            <button type="button" className="fchip" aria-pressed={onlyDue} onClick={() => setOnlyDue((v) => !v)}>Güncellenecek {due || ""}</button>
          </div>
          <section className="card rise overflow-hidden" style={order(1)} aria-label="Paylaşımlar">
            {shown.length === 0 ? (
              <Empty>{rows.length ? "Bu filtrede paylaşım yok." : "Henüz paylaşım yok. R10 konusu ya da LinkedIn gönderisi ekle; güncelleme zamanı gelince Dashboard’da hatırlatırım."}</Empty>
            ) : null}
            {shown.map((p) => (
              <PostRow key={p.id} p={p} open={open === p.id} toggle={() => navigate(open === p.id ? PATHS.posts : `${PATHS.posts}/${p.id}`, { replace: true })} />
            ))}
          </section>
        </>
      )}
    </Page>
  );
}

function PostRow({ p, open, toggle }: { p: Post; open: boolean; toggle: () => void }) {
  const [busy, setBusy] = useState(false);
  const note = refreshNote(p);
  const refresh = async () => {
    setBusy(true);
    try {
      await run("post", `/posts/${p.id}/refresh`, undefined, { ok: "Güncellendi olarak işaretlendi" });
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const remove = () => {
    void trash(`/posts/${p.id}`, `“${p.title}” paylaşımı`).catch(() => {});
  };
  return (
    <article data-record={`post-${p.id}`} className="row cv-auto flex flex-col gap-4 px-9 py-7">
      <div className="flex items-start gap-4">
        <span className={`dot mt-3 ${PLATFORM_DOT[p.platform] ?? "bg-accent-neutral"}`} />
        <div className="flex min-w-0 flex-grow flex-col gap-1">
          <span className="text-base font-medium">
            {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="text-text-primary">{p.title}</a> : p.title}
            {" "}<Who actor={p.created_by} />
          </span>
          <span className="flex flex-wrap gap-x-3 text-base-sm text-text-secondary">
            <span>{PLATFORM[p.platform]} · {fmtDay(p.posted_at)}</span>
            {note ? <span className={note.late ? "text-status-text-attention" : ""}>· {note.text}</span> : <span className="text-text-muted">· hatırlatma yok</span>}
          </span>
        </div>
        {p.refresh_due ? <Chip tone="warning">Güncelle</Chip> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <button type="button" className="fchip" aria-pressed={open} onClick={toggle} disabled={!p.people_count}>
          {p.people_count} kişi
        </button>
        {p.opp_count ? <Chip tone="opportunity">{p.opp_count} fırsat</Chip> : null}
        {p.won ? <Chip tone="success">{p.won} kazanıldı · {tl(p.won_value)}</Chip> : null}
        {p.idea_title ? <Link href={`${PATHS.ideas}/${p.idea_id}`}><Chip tone="payment">Fikir: {p.idea_title}</Chip></Link> : null}
      </div>
      {open ? <PostPeople id={p.id} /> : null}
      {p.notes ? <p className="m-0 pl-7 text-base-sm text-text-secondary">{p.notes}</p> : null}
      <div className="flex flex-wrap gap-3 pl-7">
        {p.refresh_days ? (
          <button type="button" className="btn btn-sec btn-sm inline-flex items-center gap-2" disabled={busy} onClick={refresh}>
            <Icon name="refresh" className="size-icon-sm" /> Güncelledim
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("post", { post_id: p.id })}>Düzenle</button>
        <button type="button" className="btn btn-ghost btn-sm text-status-text-danger" onClick={remove}>Sil</button>
      </div>
    </article>
  );
}

function PostPeople({ id }: { id: number }) {
  const d = useQuery<Detail<Post, { people?: Person[] }>>(`/posts/${id}?with=people`);
  const list = d.data?.related.people ?? [];
  if (!d.data) return <div className="skeleton ml-7 h-control-height-md" />;
  return (
    <div className="ml-7 flex flex-col gap-2 border-l-2 border-border-default py-1 pl-6">
      {list.map((x) => (
        <Link key={x.id} href={`${PATHS.people}/${x.id}`} className="text-base-sm text-text-neutral-chip">
          {x.name}{x.company_name ? <span className="text-text-muted"> · {x.company_name}</span> : null}
        </Link>
      ))}
    </div>
  );
}
