import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useIdeas } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, IdeaRelated, Idea } from "../api/types";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { openSheet } from "../app/ui";
import { BoardIcon } from "../components/boardIcons";
import { IdeaDetail } from "../components/ideas/IdeaDetail";
import { IdeaLanes } from "../components/ideas/IdeaLanes";
import { IdeaPeople } from "../components/ideas/IdeaPeople";
import { Empty, ErrorBox, order, PageSkeleton } from "../components/ui";
import { groupByStage } from "../lib/ideas";

/** Gelir fikirleri: four stage lanes, the chosen idea with its interest numbers, and who it was told to */
export default function Ideas() {
  const all = useIdeas();
  // project ideas live on their project's page; this screen is only the general money ideas
  const rows = useMemo(() => all.rows.filter((i) => !i.own_project_id) as Idea[], [all.rows]);
  const lanes = useMemo(() => groupByStage(rows), [rows]);
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const inProject = params.id ? all.byId.get(Number(params.id))?.own_project_id : null;
  useEffect(() => {
    if (inProject) navigate(`${PATHS.ownProjects}/${inProject}`, { replace: true });
  }, [inProject, navigate]);
  const sel = rows.find((i) => i.id === Number(params.id)) ?? lanes.find((l) => l.ideas.length)?.ideas[0];
  const pick = useCallback((id: number) => navigate(`${PATHS.ideas}/${id}`, { replace: true }), [navigate]);
  const detail = useQuery<Detail<Idea, IdeaRelated>>(sel ? `/ideas/${sel.id}?with=people,touches,posts` : null);

  return (
    <Page
      title="Gelir fikirleri"
      sub="Fikri insanlara anlat, ilgiyi say, sayı tutarsa projeye dönüştür"
      right={
        <button type="button" className="dash-new" onClick={() => openSheet("idea")}>
          <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
          Fikir ekle
        </button>
      }
    >
      {all.error && !all.data ? <ErrorBox error={all.error} retry={all.reload} /> : null}
      {!all.data ? (
        !all.error && <PageSkeleton />
      ) : (
        <>
          <div className="rise" style={order(1)}>
            <IdeaLanes lanes={lanes} selId={sel?.id} onPick={pick} />
          </div>
          {sel ? (
            <div className="ideas-main rise" style={order(2)}>
              <IdeaDetail key={sel.id} idea={sel} related={detail.data?.related} />
              <IdeaPeople ideaId={sel.id} people={detail.data?.related.people} />
            </div>
          ) : (
            <Empty>Henüz fikir yok. Ürün fikrini, çözdüğü sorunu ve hedef sektörü yaz; kime anlattığını buradan ölç.</Empty>
          )}
        </>
      )}
    </Page>
  );
}
