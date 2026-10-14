import { useState } from "react";
import { Link } from "wouter";
import { useOwnProjects, useProjects } from "../../api/keys";
import { isMissing, useModules } from "../../api/modules";
import { PATHS } from "../../app/routes";
import { ACTIVE_PROJECT_STAGES, PROJECT_SOON_DAYS, SHOWN } from "../../lib/dashboard";
import { daysFrom, fmtDay } from "../../lib/format";
import { MILESTONE, PROJECT_STEPS } from "../../lib/labels";
import { Card, Meter } from "../ui";
import { useExpand } from "../ExpandOverlay";
import { DashOverlay, type ExRow } from "./DashOverlay";

const TABS = ["Müşteri", "Kendi"];
const PERCENT = 100;

interface Row {
  key: string;
  name: string;
  client: string;
  pct: number;
  /** text on the right of the title: the next date, or the open idea count of an own project */
  due: string;
  soon: boolean;
  next: string;
  href: string;
  own: boolean;
}

/** "Projeler": client projects in progress and own projects in progress, with progress and the next step */
export function ProjectsCard() {
  const ex = useExpand();
  const [picked, setPicked] = useState(0);
  const { has } = useModules();
  const projects = useProjects(has("projects"));
  const own = useOwnProjects(has("own-projects"));
  // each half needs its module; with only one of them the tabs go and that half shows alone
  const withClient = has("projects") && !isMissing(projects.error);
  const withOwn = has("own-projects") && !isMissing(own.error);
  const tab = withClient && withOwn ? picked : withClient ? 0 : 1;
  if (!withClient && !withOwn) return null;

  const client: Row[] = projects.rows.filter((p) => ACTIVE_PROJECT_STAGES.includes(p.stage)).map((p) => {
    const dates = [p.next_payment?.due_date, p.next_task?.due_date].filter((d): d is string => !!d).sort();
    const next = p.next_task?.title ?? (p.next_payment ? `${MILESTONE[p.next_payment.milestone] ?? p.next_payment.milestone} ödemesi` : "");
    return {
      key: `c${p.id}`, name: p.name, client: p.person_name, pct: Math.round((PROJECT_STEPS.indexOf(p.stage) / (PROJECT_STEPS.length - 1)) * PERCENT),
      due: dates[0] ? fmtDay(dates[0]) : "Tarih yok", soon: !!dates[0] && daysFrom(dates[0]) <= PROJECT_SOON_DAYS, next, href: `${PATHS.projects}/${p.id}`, own: false,
    };
  });
  const mine: Row[] = own.rows.filter((p) => p.status === "aktif").map((p) => ({
    key: `o${p.id}`, name: p.name, client: "Kendi projem", pct: p.open_ideas + p.done_ideas ? Math.round((p.done_ideas / (p.open_ideas + p.done_ideas)) * PERCENT) : 0,
    due: `${p.open_ideas} açık fikir`, soon: false, next: "", href: `${PATHS.ownProjects}/${p.id}`, own: true,
  }));
  const shown = (tab === 0 ? client : mine).slice(0, SHOWN.projects);
  const everything = [...client, ...mine];
  const rows: ExRow[] = everything.map((r) => ({
    key: r.key, lead: `%${r.pct}`, mono: true, title: r.name, sub: r.next ? `${r.client} · Sıradaki: ${r.next}` : r.client, tag: r.due,
    dot: r.own ? "bg-entity-company" : "bg-entity-opportunity", href: r.href,
  }));
  const avg = everything.length ? Math.round(everything.reduce((s, r) => s + r.pct, 0) / everything.length) : 0;

  return (
    <>
      <Card title="Projeler" count={`${everything.length} proje`} onExpand={(r) => ex.show("projects", r)} className="dash-gap-6 rise">
        {withClient && withOwn ? (
          <div className="dash-tabs" role="group" aria-label="Proje türü">
            {TABS.map((t, i) => <button key={t} type="button" aria-pressed={tab === i} onClick={() => setPicked(i)}>{t}</button>)}
          </div>
        ) : null}
        <div className="flex flex-col">
          {shown.length === 0 ? <p className="m-0 border-t border-border-subtle py-5 text-base-sm text-text-muted">{tab === 0 ? "Sürmekte olan müşteri projesi yok." : "Aktif kendi projen yok."}</p> : null}
          {shown.map((r) => (
            <Link key={r.key} href={r.href} className="dash-row flex flex-col gap-3 border-t border-border-subtle py-5 text-text-primary hover:text-text-primary">
              <span className="flex items-baseline justify-between gap-4">
                <span className="min-w-0 truncate text-base">{r.name}</span>
                <span className={`flex-none font-mono text-sm ${r.soon ? "text-warning" : "text-text-secondary"}`}>{r.due}</span>
              </span>
              <span className="flex items-center gap-4">
                <Meter value={r.pct} className="flex-grow" label={r.name} />
                <span className="w-dash-pct-col text-right font-mono text-sm text-text-neutral-chip">%{r.pct}</span>
              </span>
              {r.next ? <span className="truncate text-sm text-text-secondary">Sıradaki: {r.next}</span> : null}
            </Link>
          ))}
        </div>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Projeler", sub: `${client.length} müşteri projesi, ${mine.length} kendi projen`, page: withClient ? "Müşteri projeleri" : "Kendi projelerim", href: withClient ? PATHS.projects : PATHS.ownProjects, foot: `Ortalama ilerleme %${avg}`, rows }} />
    </>
  );
}
