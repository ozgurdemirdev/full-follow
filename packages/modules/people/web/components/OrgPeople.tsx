import { Link } from "wouter";
import { run } from "@kit/api/actions";
import type { Person } from "@kit/api/types";
import { TONE_CLS } from "@kit/lib/labels";
import { INFLUENCE_LABEL, INFLUENCE_TONE, type Influence } from "../labels";
import { COLD_DAYS, daysSince, lastText, warmthOf } from "@kit/lib/people";
import { Avatar } from "@kit/components/ui";
import { PEOPLE_PATH } from "../paths";

const ROLES = Object.keys(INFLUENCE_LABEL) as Influence[];

/** The three buying roles as pills; the person's own is lit, a click sets it, a click on the lit one clears it */
function RolePicker({ p }: { p: Person }) {
  const pick = (role: Influence) => void run("patch", `/people/${p.id}`, { influence: p.influence === role ? null : role }).catch(() => {});
  return (
    <span className="co-infl" role="group" aria-label={`${p.name} karar rolü`}>
      {ROLES.map((role) => (
        <button key={role} type="button" className={`co-chip ${p.influence === role ? TONE_CLS[INFLUENCE_TONE[role]] : "is-idle"}`} aria-pressed={p.influence === role} onClick={() => pick(role)}>
          {INFLUENCE_LABEL[role]}
        </button>
      ))}
    </span>
  );
}

function OrgCard({ p }: { p: Person }) {
  const days = p.last_touch_at ? daysSince(p.last_touch_at) : null;
  const alert = p.influence === "karar_verici" && days === null;
  const tone = days === null ? "is-none" : days > COLD_DAYS ? "is-cold" : "";
  return (
    <div className="co-org" data-alert={alert}>
      <Link href={`${PEOPLE_PATH}/${p.id}`} className="co-org-link">
        <span className="flex items-center gap-4">
          <span className="ppl-av" data-warm={warmthOf(days)}>
            <Avatar name={p.name} id={p.id} size="list" />
            <span className="ppl-warm" />
          </span>
          <span className="flex min-w-0 flex-grow flex-col">
            <span className="truncate text-base font-medium">{p.name}</span>
            <span className="truncate text-sm text-text-secondary">{p.role}</span>
          </span>
          <span className={`co-last ${tone}`}>{lastText(days)}</span>
        </span>
      </Link>
      <RolePicker p={p} />
    </div>
  );
}

/** "İçerideki kişiler": who decides and who is spoken to; the role is picked right on the card */
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
