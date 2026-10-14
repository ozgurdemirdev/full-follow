import type { CSSProperties } from "react";
import type { Post } from "../../api/types";
import { staleDays } from "../../lib/posts";
import { PlatformPill, useRefresh } from "./PlatformPill";

function StaleRow({ p }: { p: Post }) {
  const { busy, refresh } = useRefresh(p.id);
  return (
    <div className="posts-stale-row rise-item">
      <PlatformPill platform={p.platform} size="lg" />
      <span className="posts-stale-text">
        <span className="posts-stale-title-line">{p.title}</span>
        <span className="posts-stale-note">{staleDays(p)} gündür güncellenmedi · {p.people_count} kişi getirmişti</span>
      </span>
      <button type="button" className="posts-act" disabled={busy} onClick={refresh}>Güncelledim</button>
    </div>
  );
}

/** Posts whose refresh date has come, oldest first */
export function StaleCard({ rows, style }: { rows: Post[]; style?: CSSProperties }) {
  return (
    <section className="posts-stale rise" style={style} aria-label="Güncelleme zamanı">
      <div className="posts-stale-head">
        <h2 className="posts-stale-title">Güncelleme zamanı</h2>
        {rows.some((p) => p.platform === "r10") ? <span className="posts-stale-hint">R10 ilanları 7 günde aşağı düşüyor, güncellemek üste taşır</span> : null}
      </div>
      {rows.map((p) => <StaleRow key={p.id} p={p} />)}
    </section>
  );
}
