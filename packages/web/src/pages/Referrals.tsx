import { Link } from "wouter";
import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { ReferralValue } from "../api/types";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { Avatar, Empty, ErrorBox, order, PageSkeleton } from "../components/ui";
import { tl } from "../lib/format";

// Kim kimi tanıttı ve tanıttıklarından (alt ağ dahil) ne iş çıktı
export default function Referrals() {
  const q = useQuery<ReferralValue[]>(K.referrals);
  const list = q.data ?? [];
  const total = list.reduce((a, r) => ({ won: a.won + r.won_value, people: a.people + r.direct }), { won: 0, people: 0 });

  return (
    <Page title="Referanslar" sub={q.data ? `${list.length} kişi ${total.people} kişiyi tanıttı · kazanılan ${tl(total.won)}` : ""} className="flex flex-col gap-7">
      {q.error && !q.data ? <ErrorBox error={q.error} retry={q.reload} /> : null}
      {!q.data ? (
        !q.error && <PageSkeleton />
      ) : (
        <section className="card rise overflow-hidden" style={order(1)} aria-label="Referans değeri">
          {list.length === 0 ? <Empty>Henüz kimse kimseyi tanıtmadı. Kişi eklerken “Tanıtan” alanını doldurunca burada görünür.</Empty> : null}
          {list.map((r, i) => (
            <Link key={r.person_id} href={`${PATHS.people}/${r.person_id}`} className="row cv-auto flex items-center gap-5 px-9 py-6 text-text-primary hover:text-text-primary">
              <span className="w-6 flex-none text-right font-mono text-sm text-text-muted">{i + 1}</span>
              <Avatar name={r.name} />
              <div className="flex min-w-0 flex-grow flex-col gap-0.5">
                <span className="truncate text-base font-medium">
                  {r.name} {r.company_name ? <span className="font-normal text-text-secondary">· {r.company_name}</span> : null}
                </span>
                <span className="text-base-sm text-text-secondary">
                  {r.direct} kişi tanıttı{r.network > r.direct ? ` · ağıyla ${r.network}` : ""}
                  {r.opps ? ` · ${r.opps} fırsat` : ""}{r.won ? `, ${r.won} kazanıldı` : ""}
                  {r.projects ? ` · ${r.projects} proje` : ""}
                </span>
              </div>
              <div className="flex flex-none flex-col items-end gap-0.5">
                <span className="font-mono text-base">{tl(r.won_value)}</span>
                {r.open_value ? <span className="text-sm text-text-secondary">açıkta {tl(r.open_value)}</span> : r.collected ? <span className="text-sm text-text-secondary">tahsil {tl(r.collected)}</span> : null}
              </div>
            </Link>
          ))}
        </section>
      )}
    </Page>
  );
}
