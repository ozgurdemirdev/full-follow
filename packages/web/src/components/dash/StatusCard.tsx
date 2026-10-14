import { Link } from "wouter";
import { useQuery } from "../../api/store";
import type { Activity } from "../../api/types";
import { PATHS } from "../../app/routes";
import { CONTACT_STATUS, STATUS_DOT } from "../../lib/labels";
import { Card } from "../ui";

const PERCENT = 100;
const GROUPS = [
  { key: "companies", label: "Firmalar", href: PATHS.companies },
  { key: "people", label: "Kişiler", href: PATHS.people },
] as const;

/** "Temas durumu": firms and people per contact status, a stacked bar and a legend each (link to the list) */
export function StatusCard() {
  const q = useQuery<Activity>("/stats/activity?period=day");
  if (!q.data) return null;
  return (
    <Card title="Temas durumu" className="dash-gap-7 rise">
      {GROUPS.map((g) => {
        const list = q.data!.status[g.key].filter((x) => x.count);
        const total = list.reduce((s, x) => s + x.count, 0);
        return (
          <Link key={g.key} href={g.href} className="flex flex-col gap-4 text-text-primary hover:text-text-primary">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-base-sm font-medium">{g.label}</span>
              <span className="font-mono text-sm text-text-secondary">{total}</span>
            </div>
            <div className="flex h-bar overflow-hidden rounded-pill bg-surface-track-alt">
              {list.map((x) => (
                <div key={x.status} className={`grow-x h-bar ${STATUS_DOT[x.status]}`} style={{ width: `${(x.count / total) * PERCENT}%` }} title={`${CONTACT_STATUS[x.status]}: ${x.count}`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
              {list.map((x) => <span key={x.status} className="inline-flex items-center gap-3"><span className={`dash-dot ${STATUS_DOT[x.status]}`} />{CONTACT_STATUS[x.status]} {x.count}</span>)}
              {!total ? <span className="text-text-muted">Henüz kayıt yok</span> : null}
            </div>
          </Link>
        );
      })}
    </Card>
  );
}
