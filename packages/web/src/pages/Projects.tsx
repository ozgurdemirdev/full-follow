import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import type { WaitKey } from "../api/types";
import { Page } from "../app/Page";
import { openSheet } from "../app/ui";
import { BoardIcon } from "../components/boardIcons";
import { ProjectRow } from "../components/projects/ProjectRow";
import { WaitCards } from "../components/projects/WaitCards";
import { ErrorBox, PageSkeleton, Segmented } from "../components/ui";
import { hasClientTasks, TABS, type TabKey, useProjectViews } from "../lib/projects";

/** Client projects: tabs, the waiting cards (filters), and one expandable row per project (/projeler/:id opens that one) */
export default function Projects() {
  const { views, ready, error, reload } = useProjectViews();
  const params = useParams<{ id?: string }>();
  const [tab, setTab] = useState<TabKey>("aktif");
  const [who, setWho] = useState<WaitKey | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const seeded = useRef<number | null>(null);

  // an address with an id (search, chat, dashboard links) lands on that project's tab with the row open
  const deep = Number(params.id) || null;
  useEffect(() => {
    if (!deep || !ready || seeded.current === deep) return;
    seeded.current = deep;
    const v = views.find((x) => x.p.id === deep);
    if (v) { setTab(v.tab); setOpen(v.p.id); }
  }, [deep, ready, views]);

  const tabs = useMemo(() => TABS.map((t) => ({ ...t, count: views.filter((v) => v.tab === t.key).length })).filter((t) => t.key !== "iptal" || t.count > 0), [views]);
  const inTab = useMemo(() => views.filter((v) => v.tab === tab), [views, tab]);
  const shown = who ? inTab.filter((v) => v.wait === who) : inTab;
  const showClient = useMemo(() => hasClientTasks(views), [views]);
  const toggle = useCallback((id: number) => setOpen((cur) => (cur === id ? null : id)), []);
  const pick = (i: number) => { setTab(tabs[i].key); setWho(null); };

  return (
    <Page
      title="Müşteri projeleri"
      sub="Her aşama bir ödemeye bağlı: iş nerede duruyorsa para da orada"
      right={
        <div className="prj-tools">
          <Segmented label="Proje durumu" size="lg" value={Math.max(0, tabs.findIndex((t) => t.key === tab))} onChange={pick}
            items={tabs.map((t) => ({ label: t.label, count: t.count }))} />
          <button type="button" className="dash-new" onClick={() => openSheet("project")}>
            <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
            Proje ekle
          </button>
        </div>
      }
    >
      {error && !ready ? <ErrorBox error={error} retry={() => void reload()} /> : null}
      {!ready ? (
        !error && <PageSkeleton />
      ) : (
        <>
          <WaitCards views={inTab} who={who} onPick={setWho} showClient={showClient} />
          <div className="prj-list">
            {shown.map((v) => <ProjectRow key={v.p.id} v={v} open={open === v.p.id} onToggle={toggle} />)}
            {shown.length === 0 ? <p className="prj-empty">Bu süzgeçte proje yok.</p> : null}
          </div>
        </>
      )}
    </Page>
  );
}
