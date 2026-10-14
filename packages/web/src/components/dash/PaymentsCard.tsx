import { useState } from "react";
import { run } from "../../api/actions";
import { useQuery } from "../../api/store";
import type { List, Payment, Report } from "../../api/types";
import { PATHS } from "../../app/routes";
import { PAYMENT_GROUPS, SHOWN, lateDays, paymentGroup, remaining, type PaymentGroup } from "../../lib/dashboard";
import { fmtDay, fmtNum, initials, lira, todayIso } from "../../lib/format";
import { MILESTONE } from "../../lib/labels";
import { NumberField } from "../NumberField";
import { Card } from "../ui";
import { useExpand } from "../ExpandOverlay";
import { DashOverlay, type ExRow } from "./DashOverlay";

const dueText = (p: Payment, today: string) => {
  const late = lateDays(p, today);
  return late ? `${late} gün gecikti` : p.due_date === today ? "bugün" : p.due_date ? fmtDay(p.due_date) : "tarih yok";
};
const label = (p: Payment) => MILESTONE[p.milestone]?.toLocaleLowerCase("tr-TR") ?? p.milestone;

/** Records a payment on one of the waiting ones (the whole remainder unless another amount is typed) */
function PayForm({ list, onDone }: { list: Payment[]; onDone: () => void }) {
  const [id, setId] = useState(list[0]?.id);
  const [amount, setAmount] = useState<number | null>(null);
  const picked = list.find((p) => p.id === id);
  const save = async () => {
    if (!picked) return;
    try {
      await run("post", `/payments/${picked.id}/pay`, { amount: amount ?? remaining(picked) }, { ok: "Ödeme kaydedildi" });
      onDone();
    } catch {
      /* the notice is shown by run() */
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <select className="inp" aria-label="Ödeme" value={id} onChange={(e) => { setId(Number(e.target.value)); setAmount(null); }}>
        {list.map((p) => <option key={p.id} value={p.id}>{p.project_name} · {label(p)} · {lira(remaining(p))}</option>)}
      </select>
      <div className="flex gap-3">
        <NumberField className="inp inp-num" min={1} max={picked ? remaining(picked) : undefined} placeholder={picked ? fmtNum(remaining(picked)) : ""} value={amount} onChange={setAmount}
          onKeyDown={(e) => e.key === "Enter" && void save()} ariaLabel="Tutar" autoFocus />
        <button type="button" className="dash-btn is-primary" onClick={() => void save()}>Kaydet</button>
        <button type="button" className="dash-btn" onClick={onDone}>Vazgeç</button>
      </div>
    </div>
  );
}

/** "Tahsilat": what is waiting, what is late, the next payments, record a payment, ask for a reminder draft */
export function PaymentsCard() {
  const ex = useExpand();
  const payments = useQuery<List<Payment>>("/payments?unpaid=true&limit=1000");
  const report = useQuery<Report>("/report");
  const [group, setGroup] = useState<PaymentGroup | null>(null);
  const [paying, setPaying] = useState(false);
  const today = todayIso();
  const all = payments.data?.rows ?? [];
  const withGroup = all.map((p) => ({ p, g: paymentGroup(p, today) }));
  const sum = (g?: PaymentGroup) => withGroup.filter((x) => !g || x.g === g).reduce((s, x) => s + remaining(x.p), 0);
  const late = withGroup.filter((x) => x.g === "late");
  const shown = withGroup.filter((x) => !group || x.g === group).slice(0, SHOWN.payments);
  const remind = (p: Payment) =>
    run("post", "/tasks", { title: `${p.project_name} için ödeme hatırlatma taslağı hazırla`, assignee: "claude", due_date: today, project_id: p.project_id }, { ok: "Claude’a görev verildi, taslak onayına düşecek" }).catch(() => {});
  const rows: ExRow[] = withGroup.map(({ p, g }) => ({
    key: p.id, lead: initials(p.project_name), title: p.project_name, sub: `${MILESTONE[p.milestone] ?? p.milestone} · ${dueText(p, today)}`, right: lira(remaining(p)),
    rightCls: g === "late" ? "text-danger-soft" : undefined, tag: PAYMENT_GROUPS.find((x) => x.key === g)!.label, dot: PAYMENT_GROUPS.find((x) => x.key === g)!.dot, href: `${PATHS.projects}/${p.project_id}`,
  }));

  return (
    <>
      <Card title="Tahsilat" count={`${all.length} ödeme`} onExpand={(r) => ex.show("payments", r)} className="dash-gap-7 rise">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-currency font-light text-text-muted">₺</span>
            <span className="text-display leading-none tracking-kpi">{fmtNum(sum())}</span>
            <span className="text-base text-text-secondary">bekliyor</span>
          </div>
          {late.length ? <span className="text-base-sm text-danger-soft">{lira(sum("late"))} gecikmiş, {late.length} ödeme</span> : null}
        </div>
        {all.length ? (
          <div className="flex flex-col gap-4">
            <div className="flex h-meter gap-1" aria-hidden="true">
              {PAYMENT_GROUPS.filter((g) => sum(g.key) > 0).map((g) => <span key={g.key} className={`rounded-pill ${g.bg}`} style={{ flex: `${sum(g.key)} 1 0` }} />)}
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              {PAYMENT_GROUPS.map((g) => (
                <button key={g.key} type="button" aria-pressed={group === g.key} onClick={() => setGroup(group === g.key ? null : g.key)}
                  className={`flex items-center gap-2 border-0 bg-transparent p-0 ${group === g.key ? "text-text-primary" : "text-text-secondary"}`}>
                  <span className={`dash-dot ${g.dot}`} />{g.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-col">
          {shown.length === 0 ? <p className="m-0 border-t border-border-subtle py-5 text-base-sm text-text-muted">{group ? "Bu grupta ödeme yok." : "Bekleyen ödeme yok."}</p> : null}
          {shown.map(({ p, g }) => (
            <div key={p.id} className="flex items-center gap-4 border-t border-border-subtle py-4">
              <div className="flex min-w-0 flex-grow flex-col">
                <span className="truncate text-base">{p.project_name}</span>
                <span className={`text-sm ${g === "late" ? "text-danger-soft" : "text-text-secondary"}`}>{MILESTONE[p.milestone] ?? p.milestone} · {dueText(p, today)}</span>
              </div>
              <span className={`flex-none font-mono text-base ${g === "late" ? "text-danger-soft" : ""}`}>{lira(remaining(p))}</span>
              {g === "late" ? <button type="button" className="dash-btn is-claude is-small flex-none" onClick={() => void remind(p)}>Hatırlat</button> : null}
            </div>
          ))}
        </div>
        {paying ? <PayForm list={all} onDone={() => setPaying(false)} /> : (
          <button type="button" className="dash-btn is-wide mt-auto" disabled={!all.length} onClick={() => setPaying(true)}>Ödeme kaydet</button>
        )}
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Tahsilat", sub: `${lira(sum())} bekliyor · ${lira(sum("late"))} gecikmiş`, page: "Projeler", href: PATHS.projects, foot: report.data ? `Bu ay tahsil edilen ${lira(report.data.month.collected)}` : "", rows }} />
    </>
  );
}
