import { useRef, useState } from "react";
import { run } from "@kit/api/actions";
import type { Idea } from "@kit/api/types";
import type { IdeaRelated } from "../types";
import { Slot } from "@kit/app/modules/Slot";
import { ratePct } from "@kit/lib/format";
import { askPitch, IDEA_FLOW } from "../ideas";
import { IDEA_STAGE } from "@kit/lib/labels";
import { useDayMarks } from "@kit/lib/people";
import { useTasksOn } from "@kit/lib/taskAccess";
import { IdeaExtras } from "./IdeaExtras";
import { m } from "../messages";
import { IdeaMenu } from "./IdeaMenu";

/** Ring geometry of the board: viewBox 36, r 15.9 so the circumference is 100 and the dash is the percent */
const RING = { box: 36, mid: 18, r: 15.9, width: 3.2, full: 100 };

function Ring({ idea }: { idea: Idea }) {
  const rate = idea.interest_share;
  const pct = rate === null ? 0 : ratePct(rate);
  return (
    <div className="ideas-ring" data-tone={idea.rate_tone ?? undefined}>
      <svg viewBox={`0 0 ${RING.box} ${RING.box}`} aria-hidden="true">
        <circle className="ideas-ring-track" cx={RING.mid} cy={RING.mid} r={RING.r} fill="none" strokeWidth={RING.width} />
        <circle className="ideas-ring-fill" cx={RING.mid} cy={RING.mid} r={RING.r} fill="none" strokeWidth={RING.width} strokeLinecap="round" strokeDasharray={`${pct} ${RING.full}`} />
      </svg>
      <span className="ideas-ring-num">
        {rate === null ? "–" : `%${pct}`}
        <small>{m.detail.interest}</small>
      </span>
    </div>
  );
}

/** The money note: click to write or edit it, it saves when the box loses focus */
function MoneyNote({ idea }: { idea: Idea }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelled = useRef(false);
  const start = () => {
    cancelled.current = false;
    setDraft(idea.money_note ?? "");
    setEditing(true);
  };
  const save = () => {
    setEditing(false);
    const next = draft.trim();
    if (cancelled.current || next === (idea.money_note ?? "")) return;
    run("patch", `/ideas/${idea.id}`, { money_note: next }, { ok: m.detail.moneySaved }).catch(() => {});
  };
  return (
    <div className="ideas-block">
      <h3>{m.detail.money}</h3>
      {editing ? (
        <textarea className="inp" rows={2} autoFocus value={draft} aria-label={m.detail.money} placeholder={m.detail.moneyPlaceholder}
          onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Escape" && ((cancelled.current = true), e.currentTarget.blur())} />
      ) : (
        <button type="button" className="ideas-note" data-empty={!idea.money_note} onClick={start}>{idea.money_note ?? m.detail.moneyEmpty}</button>
      )}
    </div>
  );
}

/** Left panel: stage, stepper, problem, money note, interest ring with the verdict, the two actions */
export function IdeaDetail({ idea, related }: { idea: Idea; related?: IdeaRelated }) {
  const [pitched, markPitched] = useDayMarks("pitched");
  const asked = pitched.has(idea.id);
  const tasksOn = useTasksOn();
  const stageIdx = IDEA_FLOW.indexOf(idea.stage);
  const move = (stage: string) => stage !== idea.stage && run("patch", `/ideas/${idea.id}`, { stage }, { ok: m.detail.stageSet(IDEA_STAGE[stage]) }).catch(() => {});

  return (
    <section aria-label={idea.title} className="ideas-detail" data-lane={idea.stage}>
      <div className="ideas-head">
        <div className="ideas-titles">
          <span className="ideas-stage">{IDEA_STAGE[idea.stage]}</span>
          <h2 className="ideas-title">{idea.title}</h2>
        </div>
        <IdeaMenu idea={idea} />
      </div>
      <div className="ideas-steps">
        {IDEA_FLOW.map((s, j) => (
          <button key={s} type="button" className="ideas-step" aria-pressed={j === stageIdx} data-on={j <= stageIdx} onClick={() => move(s)}>
            <i />
            {IDEA_STAGE[s]}
          </button>
        ))}
      </div>
      <div className="ideas-blocks">
        <div className="ideas-block">
          <h3>{m.detail.problem}</h3>
          <span>{idea.problem ?? m.detail.noProblem}</span>
        </div>
        <MoneyNote key={idea.id} idea={idea} />
      </div>
      <div className="ideas-verdict">
        <Ring idea={idea} />
        <div className="ideas-verdict-text">
          <span>{m.detail.told(idea.told, idea.interested, idea.not_interested)}</span>
          <p>{idea.verdict}</p>
        </div>
      </div>
      <div className="ideas-actions">
        <Slot name="idea.actions" props={{ idea }} />
        {tasksOn ? (
          <button type="button" className={`ideas-pitch ${asked ? "is-asked" : ""}`} onClick={() => { if (!asked) askPitch(idea).then(() => markPitched(idea.id)).catch(() => {}); }}>
            {asked ? m.pitch.asked : m.pitch.ask}
          </button>
        ) : null}
      </div>
      <IdeaExtras idea={idea} related={related} />
    </section>
  );
}
