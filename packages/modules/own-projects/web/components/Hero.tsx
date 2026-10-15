import { useRef, useState } from "react";
import { run } from "@kit/api/actions";
import type { OwnProject } from "@kit/api/types";
import { rateNote, rateText, setStage, updatedText } from "../ownProjects";
import { BoardIcon } from "@kit/components/boardIcons";
import { Journey, SellChip, StarIcon } from "./Bits";

/** Focus project: name, one line, journey, next step with its check, interest and idea counts, top ideas */
export function Hero({ p, onOpen }: { p: OwnProject; onOpen: (from: DOMRect) => void }) {
  const root = useRef<HTMLElement>(null);
  const [doneId, setDoneId] = useState<number | null>(null);
  const next = p.next_idea;
  const checked = !!next && doneId === next.id;

  /** The next step is an idea: checking it marks the idea done, the next one takes its place */
  const check = () => {
    if (!next || checked) return;
    setDoneId(next.id);
    run("patch", `/ideas/${next.id}`, { done: true }, { silent: true }).catch(() => setDoneId(null));
  };

  return (
    <section ref={root} aria-label="Odaktaki proje" className="ff-card opr-hero">
      <div className="opr-hero-grid">
        <div className="opr-hero-main">
          <div className="opr-hero-tags">
            <span className="opr-focus-chip"><StarIcon className="size-icon-sm" />Odak</span>
            <SellChip p={p} />
            <span className="opr-updated">{updatedText(p.updated_at)}</span>
          </div>
          <h2 className="opr-hero-name">{p.name}</h2>
          {p.description ? <p className="opr-oneline">{p.description}</p> : null}
          <Journey stage={p.stage} variant="hero" onPick={(step) => void setStage(p, step)} />
        </div>
        <div className="opr-hero-side">
          {next ? (
            <div className="opr-next">
              <span className="opr-label">Sıradaki adım</span>
              <div className="opr-next-row">
                <button type="button" className="opr-next-check" aria-pressed={checked} aria-label={`${next.title}, ${checked ? "tamamlandı" : "tamamla"}`} onClick={check}>
                  <BoardIcon name="check" className="size-icon-md" stroke={2.4} />
                </button>
                <span className="opr-next-text">{next.title}</span>
              </div>
            </div>
          ) : null}
          <div className="opr-stats">
            <div className="opr-stat">
              <span className="opr-label">İlgi</span>
              <span className="opr-stat-value">{rateText(p)}</span>
              <span className="opr-label">{rateNote(p)}</span>
            </div>
            <div className="opr-stat">
              <span className="opr-label">Fikirler</span>
              <span className="opr-stat-value">{p.open_ideas}</span>
              <span className="opr-label">açık · {p.done_ideas} yapıldı</span>
            </div>
          </div>
        </div>
      </div>
      <div className="opr-hero-foot">
        {p.top_ideas.length ? <span className="opr-top">Öncelikli: {p.top_ideas.map((i) => i.title).join(", ")}</span> : null}
        <button type="button" className="ff-more" aria-label={`${p.name} projesini aç`} onClick={() => root.current && onOpen(root.current.getBoundingClientRect())}>
          Projeyi aç
          <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={2.2} /></span>
        </button>
      </div>
    </section>
  );
}
