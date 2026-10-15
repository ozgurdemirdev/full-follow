import type { CSSProperties } from "react";
import type { Post } from "@kit/api/types";
import { m } from "../messages";
import { staleDays } from "../posts";
import { PlatformPill, useRefresh } from "./PlatformPill";

function StaleRow({ p }: { p: Post }) {
  const { busy, refresh } = useRefresh(p.id);
  return (
    <div className="posts-stale-row rise-item">
      <PlatformPill platform={p.platform} size="lg" />
      <span className="posts-stale-text">
        <span className="posts-stale-title-line">{p.title}</span>
        <span className="posts-stale-note">{m.stale.note(staleDays(p), p.people_count)}</span>
      </span>
      <button type="button" className="posts-act" disabled={busy} onClick={refresh}>{m.refreshedButton}</button>
    </div>
  );
}

/** Posts whose refresh date has come, oldest first */
export function StaleCard({ rows, style }: { rows: Post[]; style?: CSSProperties }) {
  return (
    <section className="posts-stale rise" style={style} aria-label={m.stale.title}>
      <div className="posts-stale-head">
        <h2 className="posts-stale-title">{m.stale.title}</h2>
        {rows.some((p) => p.platform === "r10") ? <span className="posts-stale-hint">{m.stale.hint}</span> : null}
      </div>
      {rows.map((p) => <StaleRow key={p.id} p={p} />)}
    </section>
  );
}
