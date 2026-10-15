// Kendi projelerim: odaktaki proje, üzerinde çalışılanlar, raf, proje penceresi (fikirler, satılabilirlik, linkler)
import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { run } from "@kit/api/actions";
import { useOwnProjects } from "@kit/api/keys";
import type { OwnProject } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { Gallery } from "../components/Gallery";
import { Hero } from "../components/Hero";
import { ProjectOverlay } from "../components/ProjectOverlay";
import { Shelf } from "../components/Shelf";
import { Empty, ErrorBox, PageSkeleton } from "@kit/components/ui";
import { OWN_PROJECTS_PATH } from "../paths";
import { onShelf, useFocusId } from "../ownProjects";
import { STROKE } from "../constants";
import { m } from "../messages";

/** Size of the box the overlay grows from when a project is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

export default function OwnProjects() {
  const projects = useOwnProjects();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const focusPick = useFocusId();
  const [from, setFrom] = useState<DOMRect | null>(null);
  const openId = Number(params.id) || null;

  const rows = projects.rows;
  const live = useMemo(() => rows.filter((p) => !onShelf(p)), [rows]);
  const shelf = useMemo(() => rows.filter(onShelf), [rows]);
  const focus = live.find((p) => p.id === focusPick.id) ?? live[0];
  const others = useMemo(() => live.filter((p) => p !== focus), [live, focus]);
  const openIdeas = live.reduce((a, p) => a + p.open_ideas, 0);
  const error = projects.error && !projects.data ? projects : null;

  const open = (id: number, rect: DOMRect) => {
    setFrom(rect);
    navigate(`${OWN_PROJECTS_PATH}/${id}`, { replace: true });
  };
  const revive = (p: OwnProject) => run("patch", `/own-projects/${p.id}`, { status: "aktif" }, { ok: m.revived(p.name) }).catch(() => {});
  const makeFocus = (p: OwnProject) => {
    void focusPick.set(p.id);
    if (onShelf(p)) void revive(p);
  };

  return (
    <Page
      title={m.label}
      sub={projects.data ? m.sub(live.length, openIdeas) : ""}
      right={
        <button type="button" className="dash-new" onClick={() => openSheet("own_project")}>
          <BoardIcon name="plus" className="size-icon-md" stroke={STROKE.regular} />
          {m.addProject}
        </button>
      }
    >
      {error ? <ErrorBox error={error.error} retry={error.reload} /> : null}
      {!projects.data || focusPick.loading ? (
        !error && <PageSkeleton />
      ) : (
        <>
          {rows.length === 0 ? <Empty>{m.empty}</Empty> : null}
          {focus ? <Hero key={focus.id} p={focus} onOpen={(rect) => open(focus.id, rect)} /> : null}
          <Gallery rows={others} onOpen={open} />
          <Shelf rows={shelf} onRevive={revive} />
          <ProjectOverlay id={openId} from={openId ? (from ?? fallbackRect()) : from} p={openId ? rows.find((p) => p.id === openId) : undefined}
            isFocus={!!focus && focus.id === openId} onFocus={makeFocus} onClose={() => navigate(OWN_PROJECTS_PATH, { replace: true })} />
        </>
      )}
    </Page>
  );
}
