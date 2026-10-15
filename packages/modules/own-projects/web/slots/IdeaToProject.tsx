import { useLocation } from "wouter";
import { run } from "@kit/api/actions";
import type { Idea } from "@kit/api/types";
import { linkTo } from "@kit/app/modules/links";
import { BoardIcon } from "@kit/components/boardIcons";

/** "Projeye dönüştür" on an idea (the `idea.actions` slot of the ideas screen): opens an own project from the idea and goes to it */
export default function IdeaToProject({ idea }: { idea: Idea }) {
  const [, navigate] = useLocation();
  if (idea.parent_id) return null;
  const toProject = async () => {
    try {
      const r = await run<{ id: number }>("post", `/own-projects/from-idea/${idea.id}`, {}, { ok: "Proje açıldı, Kendi projelerim’de" });
      const page = r.row ? linkTo("own_project", r.row.id) : null;
      if (page) navigate(page);
    } catch {
      /* the notice is shown by run() */
    }
  };
  return (
    <button type="button" className="ideas-project" onClick={() => void toProject()}>
      Projeye dönüştür
      <span className="ideas-go"><BoardIcon name="arrowRight" className="size-icon-xs" stroke={2.4} /></span>
    </button>
  );
}
