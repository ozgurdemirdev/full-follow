import { Link } from "wouter";
import { useQuery } from "@kit/api/store";
import type { Activity } from "@kit/api/types";
import { useRegistry } from "@kit/app/modules/registry";
import { CONTACT_STATUS } from "@kit/lib/labels";
import { STATUS_DOT } from "../labels";
import { Card } from "@kit/components/ui";

const PERCENT = 100;
/** `page` is the route id of the list the group links to (no link when no module has that page) */
const GROUPS = [
  { key: "companies", label: "Firmalar", page: "companies" },
  { key: "people", label: "Kişiler", page: "people" },
] as const;

/** "Temas durumu": firms and people per contact status, a stacked bar and a legend each (link to the list) */
export function StatusCard() {
  const q = useQuery<Activity>("/stats/activity?period=day");
  const { pagePath } = useRegistry();
  if (!q.data) return null;
  return (
    <Card title="Temas durumu" className="dash-gap-7 rise">
      {GROUPS.map((g) => {
        const list = q.data!.status[g.key].filter((x) => x.count);
        const total = list.reduce((s, x) => s + x.count, 0);
        const href = pagePath(g.page);
        const body = (
          <>
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
          </>
        );
        const cls = "flex flex-col gap-4 text-text-primary hover:text-text-primary";
        return href ? <Link key={g.key} href={href} className={cls}>{body}</Link> : <div key={g.key} className={cls}>{body}</div>;
      })}
    </Card>
  );
}
