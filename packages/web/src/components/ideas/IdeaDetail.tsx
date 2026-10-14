import { useLocation } from "wouter";
import { run } from "../../api/actions";
import type { IdeaRelated, IdeaRow } from "../../api/types";
import { PATHS } from "../../app/routes";
import { askPitch, IDEA_FLOW, rateOf, rateTone, ratePct, verdictOf } from "../../lib/ideas";
import { IDEA_STAGE } from "../../lib/labels";
import { useDayMarks } from "../../lib/people";
import { BoardIcon } from "../boardIcons";
import { IdeaExtras } from "./IdeaExtras";
import { IdeaMenu } from "./IdeaMenu";

/** Ring geometry of the board: viewBox 36, r 15.9 so the circumference is 100 and the dash is the percent */
const RING = { box: 36, mid: 18, r: 15.9, width: 3.2, full: 100 };

function Ring({ idea }: { idea: IdeaRow }) {
  const rate = rateOf(idea);
  const pct = rate === null ? 0 : ratePct(rate);
  return (
    <div className="ideas-ring" data-tone={rate === null ? undefined : rateTone(rate)}>
      <svg viewBox={`0 0 ${RING.box} ${RING.box}`} aria-hidden="true">
        <circle className="ideas-ring-track" cx={RING.mid} cy={RING.mid} r={RING.r} fill="none" strokeWidth={RING.width} />
        <circle className="ideas-ring-fill" cx={RING.mid} cy={RING.mid} r={RING.r} fill="none" strokeWidth={RING.width} strokeLinecap="round" strokeDasharray={`${pct} ${RING.full}`} />
      </svg>
      <span className="ideas-ring-num">
        {rate === null ? "–" : `%${pct}`}
        <small>ilgi</small>
      </span>
    </div>
  );
}

/** Left panel: stage, stepper, problem, money note, interest ring with the verdict, the two actions */
export function IdeaDetail({ idea, related }: { idea: IdeaRow; related?: IdeaRelated }) {
  const [, navigate] = useLocation();
  const [pitched, markPitched] = useDayMarks("pitched");
  const asked = pitched.has(idea.id);
  const stageIdx = IDEA_FLOW.indexOf(idea.stage);
  const move = (stage: string) => stage !== idea.stage && run("patch", `/ideas/${idea.id}`, { stage }, { ok: `Aşama: ${IDEA_STAGE[stage]}` }).catch(() => {});
  const toProject = async () => {
    try {
      const r = await run<{ id: number }>("post", `/own-projects/from-idea/${idea.id}`, {}, { ok: "Proje açıldı, Kendi projelerim’de" });
      if (r.row) navigate(`${PATHS.ownProjects}/${r.row.id}`);
    } catch {
      /* the notice is shown by run() */
    }
  };

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
          <h3>Çözdüğü sorun</h3>
          <span>{idea.problem ?? "Çözdüğü sorun yazılmadı"}</span>
        </div>
        {idea.money_note ? (
          <div className="ideas-block">
            <h3>Para hesabı</h3>
            <span>{idea.money_note}</span>
          </div>
        ) : null}
      </div>
      <div className="ideas-verdict">
        <Ring idea={idea} />
        <div className="ideas-verdict-text">
          <span>{idea.told} kişiye anlatıldı · {idea.interested} ilgilendi · {idea.not_interested} ilgilenmedi</span>
          <p>{verdictOf(idea)}</p>
        </div>
      </div>
      <div className="ideas-actions">
        {!idea.parent_id ? (
          <button type="button" className="ideas-project" onClick={() => void toProject()}>
            Projeye dönüştür
            <span className="ideas-go"><BoardIcon name="arrowRight" className="size-icon-xs" stroke={2.4} /></span>
          </button>
        ) : null}
        <button type="button" className={`ideas-pitch ${asked ? "is-asked" : ""}`} onClick={() => { if (!asked) askPitch(idea).then(() => markPitched(idea.id)).catch(() => {}); }}>
          {asked ? "Anlatım metni istendi" : "Claude anlatım metni yazsın"}
        </button>
      </div>
      <IdeaExtras idea={idea} related={related} />
    </section>
  );
}
