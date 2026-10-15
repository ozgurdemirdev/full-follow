import { useEffect, useRef } from "react";
import { Link } from "wouter";
import type { TlRec } from "../types";
import { linkTo } from "@kit/app/modules/links";
import { recKind, recTone } from "../timeline";
import { PathIcon } from "./PathIcon";

/** "Kişi geçmişi" card above the feed while one record is focused: opens the record or goes back to everything */
export function FocusCard({ rec, summary, onClear }: { rec: TlRec; summary: string; onClear: () => void }) {
  const root = useRef<HTMLElement>(null);
  const kind = recKind(rec.kind);
  // a chip far down the feed focuses a record: bring the card into view
  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest" });
  }, [rec.kind, rec.id]);
  return (
    <section ref={root} aria-label={rec.name} className="tlx-focus" data-rec={recTone(rec.kind)}>
      <span className="tlx-focus-icon"><PathIcon d={kind.icon} className="size-icon-xl" stroke={1.7} /></span>
      <div className="tlx-focus-text">
        <span className="tlx-focus-kind">{kind.label} geçmişi</span>
        <span className="tlx-focus-name">{rec.name}</span>
        <span className="tlx-focus-sum">{summary}</span>
      </div>
      <Link href={linkTo(rec.kind, rec.id) ?? "#"} className="tlx-open">Kartı aç</Link>
      <button type="button" className="tlx-back" onClick={onClear}>Hepsine dön</button>
    </section>
  );
}
