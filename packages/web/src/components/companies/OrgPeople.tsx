import { Link } from "wouter";
import type { Person } from "../../api/types";
import { PATHS } from "../../app/routes";
import { COLD_DAYS, daysSince, INFLUENCE_LABEL, INFLUENCE_TONE, lastText, warmthOf } from "../../lib/companies";
import { TONE_CLS } from "../../lib/labels";
import { Avatar } from "../ui";

function OrgCard({ p }: { p: Person }) {
  const days = p.last_touch_at ? daysSince(p.last_touch_at) : null;
  const alert = p.influence === "karar_verici" && days === null;
  const tone = days === null ? "is-none" : days > COLD_DAYS ? "is-cold" : "";
  return (
    <Link href={`${PATHS.people}/${p.id}`} className="co-org" data-alert={alert}>
      <span className="flex items-center gap-4">
        <span className="ppl-av" data-warm={warmthOf(days)}>
          <Avatar name={p.name} id={p.id} size="list" />
          <span className="ppl-warm" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-medium">{p.name}</span>
          <span className="truncate text-sm text-text-secondary">{p.role}</span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-3">
        {p.influence ? <span className={`co-chip ${TONE_CLS[INFLUENCE_TONE[p.influence]]}`}>{INFLUENCE_LABEL[p.influence]}</span> : null}
        <span className={`co-last ${tone}`}>{lastText(days)}</span>
      </span>
    </Link>
  );
}

/** "İçerideki kişiler": who decides and who is spoken to; the role chip shows when core provides the influence role */
export function OrgPeople({ people }: { people: Person[] }) {
  return (
    <div className="co-section">
      <div className="co-h3-row">
        <h3 className="co-h3">İçerideki kişiler</h3>
        <span className="text-sm text-text-muted">Karar kimde, kiminle konuşuyorsun</span>
      </div>
      {people.length ? (
        <div className="co-orgs">{people.map((p) => <OrgCard key={p.id} p={p} />)}</div>
      ) : (
        <span className="text-base-sm text-text-muted">Henüz kişi yok. Cevap veren kişiyi ekleyince temasları burada da görünür.</span>
      )}
    </div>
  );
}
