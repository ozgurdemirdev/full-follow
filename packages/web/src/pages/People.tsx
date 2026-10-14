import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { K, useOpenTasks, usePeople, useSectors } from "../api/keys";
import { useQuery } from "../api/store";
import type { Today } from "../api/types";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { openSheet } from "../app/ui";
import { BoardIcon } from "../components/boardIcons";
import { matchLabels, noFilter, type LabelFilter } from "../components/filters";
import { type StatusFilter } from "../components/people/FilterBar";
import { PeopleList } from "../components/people/PeopleList";
import { PersonOverlay } from "../components/people/PersonOverlay";
import { TouchCards } from "../components/people/TouchCards";
import { ErrorBox, PageSkeleton } from "../components/ui";
import { norm, todayIso } from "../lib/format";
import { channelsOf, STATUS_RANK, statusOf } from "../lib/people";

/** Size of the box the overlay grows from when a person is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

/** People: "Bugün dokun" cards, the filterable list, and the person overlay (the address /kisiler/:id opens it) */
export default function People() {
  const people = usePeople();
  const sectors = useSectors();
  const tasks = useOpenTasks();
  const today = useQuery<Today>(K.today);
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [chan, setChan] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelFilter>(noFilter);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const day = todayIso();
  const openId = Number(params.id) || null;

  const base = useMemo(() => {
    const n = norm(q.trim());
    return people.rows.filter((p) => matchLabels(p, labels, sectors.rows) && (!chan || channelsOf(p).some((c) => c.key === chan)) &&
      (!n || [p.name, p.company_name, p.role, p.sector_path, p.email, p.instagram, p.linkedin, p.tags.join(" ")].some((x) => norm(x).includes(n))));
  }, [people.rows, sectors.rows, labels, chan, q]);
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: base.length, due: 0, wait: 0, cold: 0, fresh: 0 };
    for (const p of base) { const s = statusOf(p, day); if (s !== "ok") c[s]++; }
    return c;
  }, [base, day]);
  const rows = useMemo(
    () => base.filter((p) => status === "all" || statusOf(p, day) === status).sort((a, b) => STATUS_RANK[statusOf(a, day)] - STATUS_RANK[statusOf(b, day)]),
    [base, status, day],
  );
  const open = (id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${PATHS.people}/${id}`, { replace: true });
  };
  const week = today.data ? today.data.week.sent + today.data.week.replies : null;
  const cold = people.rows.filter((p) => p.cooling).length;
  const sub = people.data ? `${people.rows.length} kişi${week === null ? "" : ` · bu hafta ${week} temas`} · ${cold} ilişki soğuyor` : "";

  return (
    <Page
      title="Kişiler"
      sub={sub}
      className="flex flex-col gap-10"
      right={
        <div className="ppl-tools">
          <label className="ppl-search">
            <BoardIcon name="search" className="size-icon-md" stroke={1.8} />
            <span className="sr-only">Kişi ara</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, firma ya da etiket" />
          </label>
          <button type="button" className="dash-new" onClick={() => openSheet("person")}>
            <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
            Kişi ekle
          </button>
        </div>
      }
    >
      {people.error && !people.data ? <ErrorBox error={people.error} retry={people.reload} /> : null}
      {!people.data ? (
        !people.error && <PageSkeleton />
      ) : (
        <>
          <TouchCards people={people.rows} today={day} onOpen={open} />
          <PeopleList rows={rows} tasks={tasks.rows.filter((t) => t.assignee !== "claude")} today={day} counts={counts} status={status} onStatus={setStatus}
            chan={chan} onChan={setChan} labels={labels} onLabels={setLabels} onOpen={open} />
          <PersonOverlay id={openId} from={openId ? (from ?? fallbackRect()) : from} p={openId ? people.byId.get(openId) : undefined}
            onClose={() => navigate(PATHS.people, { replace: true })} />
        </>
      )}
    </Page>
  );
}
