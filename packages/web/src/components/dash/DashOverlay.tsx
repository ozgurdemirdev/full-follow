import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { norm } from "../../lib/format";
import { dash } from "../../messages.dash";
import { BoardIcon } from "../boardIcons";
import { ExpandLink, ExpandOverlay } from "../ExpandOverlay";
import { stroke as STROKE } from "../../styles/tokens.json";

const m = dash.overlay;

export interface ExRow {
  key: string | number;
  /** text of the round lead chip (initials, time, percent) */
  lead: string;
  mono?: boolean;
  title: string;
  sub: string;
  right?: string;
  /** text colour class of `right` */
  rightCls?: string;
  tag: string;
  /** background class of the dot in front of the tag */
  dot: string;
  href: string;
}

export interface ExSpec {
  title: string;
  sub: ReactNode;
  /** name of the page the footer link goes to ("Takvim" gives "Takvim sayfasına git") */
  page: string;
  href: string;
  foot: ReactNode;
  rows: ExRow[];
}

/** The expand overlay of a dashboard card: searchable list in the board's row design and a link to the full page */
export function DashOverlay({ open, from, onClose, spec }: { open: boolean; from: DOMRect | null; onClose: () => void; spec: ExSpec }) {
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const rows = needle ? spec.rows.filter((r) => norm(`${r.title} ${r.sub}`).includes(needle)) : spec.rows;
  return (
    <ExpandOverlay
      open={open}
      from={from}
      title={spec.title}
      sub={spec.sub}
      onClose={onClose}
      toolbar={
        <label className="dash-ex-search">
          <BoardIcon name="search" className="size-icon-md" stroke={STROKE.thin} />
          <span className="sr-only">{m.search}</span>
          <input type="search" placeholder={m.search} value={q} onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-grow border-0 bg-transparent text-base text-text-primary outline-0 placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden" />
        </label>
      }
      footer={
        <>
          <span>{spec.foot}</span>
          <ExpandLink href={spec.href}>{m.toPage(spec.page)}</ExpandLink>
        </>
      }
    >
      {rows.map((r) => (
        <Link key={r.key} href={r.href} className="dash-ex-row">
          <span className={`dash-av min-w-avatar-tile h-avatar-tile px-3 text-sm ${r.mono ? "font-mono" : ""}`}>{r.lead}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-md">{r.title}</span>
            <span className="truncate text-base-sm text-text-secondary">{r.sub}</span>
          </span>
          <span className="flex items-center gap-5">
            {r.right ? <span className={`font-mono text-base ${r.rightCls ?? "text-text-neutral-chip"}`}>{r.right}</span> : null}
            <span className="dash-chip is-pill gap-2 text-sm"><span className={`dash-dot ${r.dot}`} />{r.tag}</span>
          </span>
        </Link>
      ))}
      {rows.length === 0 ? <p className="empty">{m.none}</p> : null}
    </ExpandOverlay>
  );
}
