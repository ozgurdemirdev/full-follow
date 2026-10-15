import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePosts } from "@kit/api/keys";
import { drained } from "@kit/api/paged";
import { useQuery } from "@kit/api/store";
import type { List, Person } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { POSTS_PATH } from "../paths";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { LoadMore } from "@kit/components/LoadMore";
import { TileColumns } from "@kit/components/layout";
import { PlatformStrip } from "../components/PlatformStrip";
import { PostOverlay } from "../components/PostOverlay";
import { PostTile } from "../components/PostTile";
import { StaleCard } from "../components/StaleCard";
import { Empty, ErrorBox, Filters, order, PageSkeleton } from "@kit/components/ui";
import { TILE_PAGE } from "../constants";
import { m } from "../messages";
import { byValue, peopleByPost, perPost, platformStats, staleDays } from "../posts";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Size of the box the overlay grows from when a post is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);
const NO_PEOPLE: Person[] = [];

/** Posts: refresh reminders, the platform strip, the filterable tiles and the post overlay (the address /paylasimlar/:id opens it) */
export default function Posts() {
  const posts = usePosts();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [platform, setPlatform] = useState("");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const [drawn, setDrawn] = useState(TILE_PAGE);
  const openId = Number(params.id) || null;

  const sorted = useMemo(() => posts.rows.slice().sort(byValue), [posts.rows]);
  const due = useMemo(() => posts.rows.filter((p) => p.refresh_due).sort((a, b) => staleDays(b) - staleDays(a)), [posts.rows]);
  const stats = useMemo(() => platformStats(posts.rows), [posts.rows]);
  const per = useMemo(() => perPost(posts.rows, stats), [posts.rows, stats]);
  const shown = useMemo(() => sorted.filter((p) => !platform || p.platform === platform), [sorted, platform]);
  const tiles = useMemo(() => shown.slice(0, drawn), [shown, drawn]);
  // the people of the tiles on screen, and of the open post: asked of the server by post, never the whole people book
  const tilePeople = useQuery<List<Person>>(tiles.length ? `/people/overview?post_ids=${tiles.map((p) => p.id).join(",")}` : null, drained);
  const openPeople = useQuery<List<Person>>(openId ? `/people/overview?post_ids=${openId}` : null, drained);
  const byPost = useMemo(() => peopleByPost(tilePeople.data?.rows ?? NO_PEOPLE), [tilePeople.data]);
  const people = useMemo(() => openPeople.data?.rows ?? NO_PEOPLE, [openPeople.data]);
  const tabs = useMemo(() => [{ value: "", label: kit.all }, ...stats.map((s) => ({ value: s.key, label: s.name }))], [stats]);

  const open = useCallback((id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${POSTS_PATH}/${id}`, { replace: true });
  }, [navigate]);

  return (
    <Page
      title={m.label}
      sub={m.page.sub}
      className="flex flex-col gap-10"
      right={
        <button type="button" className="dash-new" onClick={() => openSheet("post")}>
          <BoardIcon name="plus" className="size-icon-md" stroke={STROKE.medium} />
          {m.page.add}
        </button>
      }
    >
      {posts.error && !posts.data ? <ErrorBox error={posts.error} retry={posts.reload} /> : null}
      {!posts.data ? (
        !posts.error && <PageSkeleton />
      ) : posts.rows.length === 0 ? (
        <Empty>{m.page.empty}</Empty>
      ) : (
        <>
          {due.length ? <StaleCard rows={due} style={order(1)} /> : null}
          <PlatformStrip stats={stats} per={per} style={order(2)} />
          <div className="posts-bar rise" style={order(3)}>
            <Filters label={m.common.platform} value={platform} onChange={(v) => (setPlatform(v), setDrawn(TILE_PAGE))} items={tabs} />
            <span className="flex-grow" />
            <span className="posts-bar-note">{m.page.mostWork}</span>
          </div>
          {shown.length ? (
            <div className="rise" style={order(4)}>
              <TileColumns>
                {tiles.map((p) => <PostTile key={p.id} p={p} people={byPost.get(p.id) ?? NO_PEOPLE} onOpen={open} />)}
              </TileColumns>
              <LoadMore hasMore={shown.length > drawn} loaded={drawn} onMore={() => setDrawn((n) => n + TILE_PAGE)} />
            </div>
          ) : <Empty>{m.page.noneInFilter}</Empty>}
          <PostOverlay
            id={openId}
            from={openId ? (from ?? fallbackRect()) : from}
            p={openId ? posts.byId.get(openId) : undefined}
            people={openId ? people : NO_PEOPLE}
            onClose={() => navigate(POSTS_PATH, { replace: true })}
          />
        </>
      )}
    </Page>
  );
}
