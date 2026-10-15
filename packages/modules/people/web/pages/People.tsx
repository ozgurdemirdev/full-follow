import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { K, useOpenTasks, usePeople, useSectors } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Today } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { matchLabels, noFilter, type LabelFilter } from "@kit/components/filters";
import { PEOPLE_PATH } from "../paths";
import { type StatusFilter } from "../components/FilterBar";
import { PeopleList } from "../components/PeopleList";
import { PersonOverlay } from "../components/PersonOverlay";
import { TouchCards } from "../components/TouchCards";
import { ErrorBox, PageSkeleton } from "@kit/components/ui";
import { norm, todayIso } from "@kit/lib/format";
import { channelsOf, STATUS_RANK, statusOf } from "@kit/lib/people";

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
  // one status per person per data change: the filters, the counts and the sort read it instead of recomputing it
  const statuses = useMemo(() => new Map(people.rows.map((p) => [p.id, statusOf(p, day)])), [people.rows, day]);
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: base.length, due: 0, wait: 0, cold: 0, fresh: 0 };
    for (const p of base) { const s = statuses.get(p.id)!; if (s !== "ok") c[s]++; }
    return c;
  }, [base, statuses]);
  const rows = useMemo(
    () => base.filter((p) => status === "all" || statuses.get(p.id) === status).sort((a, b) => STATUS_RANK[statuses.get(a.id)!] - STATUS_RANK[statuses.get(b.id)!]),
    [base, status, statuses],
  );
  const ownTasks = useMemo(() => tasks.rows.filter((t) => t.assignee !== "claude"), [tasks.rows]);
  // stable, so the memoized rows do not re-render when the overlay opens
  const open = useCallback((id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${PEOPLE_PATH}/${id}`, { replace: true });
  }, [navigate]);
  const week = today.data?.week ? today.data.week.sent + today.data.week.replies : null;
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
          <PeopleList rows={rows} tasks={ownTasks} today={day} counts={counts} status={status} onStatus={setStatus}
            chan={chan} onChan={setChan} labels={labels} onLabels={setLabels} onOpen={open} />
          <PersonOverlay id={openId} from={openId ? (from ?? fallbackRect()) : from} p={openId ? people.byId.get(openId) : undefined}
            onClose={() => navigate(PEOPLE_PATH, { replace: true })} />
        </>
      )}
    </Page>
  );
}
