import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePeople, usePosts } from "@kit/api/keys";
import type { Person } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { POSTS_PATH } from "../paths";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { TileColumns } from "@kit/components/layout";
import { PlatformStrip } from "../components/PlatformStrip";
import { PostOverlay } from "../components/PostOverlay";
import { PostTile } from "../components/PostTile";
import { StaleCard } from "../components/StaleCard";
import { Empty, ErrorBox, Filters, order, PageSkeleton } from "@kit/components/ui";
import { byValue, peopleByPost, perPost, platformStats, staleDays } from "../posts";

/** Size of the box the overlay grows from when a post is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);
const NO_PEOPLE: Person[] = [];

/** Posts: refresh reminders, the platform strip, the filterable tiles and the post overlay (the address /paylasimlar/:id opens it) */
export default function Posts() {
  const posts = usePosts();
  const people = usePeople();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [platform, setPlatform] = useState("");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const openId = Number(params.id) || null;

  const sorted = useMemo(() => posts.rows.slice().sort(byValue), [posts.rows]);
  const due = useMemo(() => posts.rows.filter((p) => p.refresh_due).sort((a, b) => staleDays(b) - staleDays(a)), [posts.rows]);
  const stats = useMemo(() => platformStats(posts.rows), [posts.rows]);
  const per = useMemo(() => perPost(posts.rows, stats), [posts.rows, stats]);
  const byPost = useMemo(() => peopleByPost(people.rows), [people.rows]);
  const shown = useMemo(() => sorted.filter((p) => !platform || p.platform === platform), [sorted, platform]);
  const tabs = useMemo(() => [{ value: "", label: "Hepsi" }, ...stats.map((s) => ({ value: s.key, label: s.name }))], [stats]);

  const open = useCallback((id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${POSTS_PATH}/${id}`, { replace: true });
  }, [navigate]);

  return (
    <Page
      title="Paylaşımlar"
      sub="Hangi paylaşım kimi getirdi, kim işe dönüştü"
      className="flex flex-col gap-10"
      right={
        <button type="button" className="dash-new" onClick={() => openSheet("post")}>
          <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
          Paylaşım ekle
        </button>
      }
    >
      {posts.error && !posts.data ? <ErrorBox error={posts.error} retry={posts.reload} /> : null}
      {!posts.data ? (
        !posts.error && <PageSkeleton />
      ) : posts.rows.length === 0 ? (
        <Empty>Henüz paylaşım yok. R10 konusu ya da LinkedIn gönderisi ekle; güncelleme zamanı gelince Dashboard’da hatırlatırım.</Empty>
      ) : (
        <>
          {due.length ? <StaleCard rows={due} style={order(1)} /> : null}
          <PlatformStrip stats={stats} per={per} style={order(2)} />
          <div className="posts-bar rise" style={order(3)}>
            <Filters label="Platform" value={platform} onChange={setPlatform} items={tabs} />
            <span className="flex-grow" />
            <span className="posts-bar-note">En çok iş getiren önce</span>
          </div>
          {shown.length ? (
            <div className="rise" style={order(4)}>
              <TileColumns>
                {shown.map((p) => <PostTile key={p.id} p={p} people={byPost.get(p.id) ?? NO_PEOPLE} onOpen={open} />)}
              </TileColumns>
            </div>
          ) : <Empty>Bu filtrede paylaşım yok.</Empty>}
          <PostOverlay
            id={openId}
            from={openId ? (from ?? fallbackRect()) : from}
            p={openId ? posts.byId.get(openId) : undefined}
            people={openId ? (byPost.get(openId) ?? NO_PEOPLE) : NO_PEOPLE}
            onClose={() => navigate(POSTS_PATH, { replace: true })}
          />
        </>
      )}
    </Page>
  );
}
