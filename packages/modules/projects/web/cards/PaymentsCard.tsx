import { useState } from "react";
import { run } from "@kit/api/actions";
import { isMissing } from "@kit/api/modules";
import { drained } from "@kit/api/paged";
import { useQuery } from "@kit/api/store";
import type { List, Payment, Report } from "@kit/api/types";
import { PAYMENT_GROUPS, SHOWN, lateDays, paymentGroup, remaining, type PaymentGroup } from "@kit/lib/dashboard";
import { fmtDay, fmtNum, initials, lira, todayIso } from "@kit/lib/format";
import { LOCALE } from "@kit/lib/i18n";
import { useCanAsk } from "@kit/lib/askClaude";
import { AskButton } from "@kit/components/AskButton";
import { MILESTONE } from "@kit/lib/labels";
import { MIN_PAYMENT } from "../constants";
import { m } from "../messages";
import { PROJECTS_PATH } from "../paths";
import { reminderRequest } from "../projects";
import { NumberField } from "@kit/components/NumberField";
import { Card } from "@kit/components/ui";
import { useExpand } from "@kit/components/ExpandOverlay";
import { DashOverlay, type ExRow } from "@kit/components/dash/DashOverlay";
import { m as kit } from "@kit/messages";

const dueText = (p: Payment, today: string) => {
  const late = lateDays(p, today);
  return late ? m.card.late(late) : p.due_date === today ? m.card.today : p.due_date ? fmtDay(p.due_date) : m.card.noDate;
};
const label = (p: Payment) => MILESTONE[p.milestone]?.toLocaleLowerCase(LOCALE) ?? p.milestone;

/** Records a payment on one of the waiting ones (the whole remainder unless another amount is typed) */
function PayForm({ list, onDone }: { list: Payment[]; onDone: () => void }) {
  const [id, setId] = useState(list[0]?.id);
  const [amount, setAmount] = useState<number | null>(null);
  const picked = list.find((p) => p.id === id);
  const save = async () => {
    if (!picked) return;
    try {
      await run("post", `/payments/${picked.id}/pay`, { amount: amount ?? remaining(picked) }, { ok: m.aside.paymentSaved });
      onDone();
    } catch {
      /* the notice is shown by run() */
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <select className="inp" aria-label={m.card.payment} value={id} onChange={(e) => { setId(Number(e.target.value)); setAmount(null); }}>
        {list.map((p) => <option key={p.id} value={p.id}>{p.project_name} · {label(p)} · {lira(remaining(p))}</option>)}
      </select>
      <div className="flex gap-3">
        <NumberField className="inp inp-num" min={MIN_PAYMENT} max={picked ? remaining(picked) : undefined} placeholder={picked ? fmtNum(remaining(picked)) : ""} value={amount} onChange={setAmount}
          onKeyDown={(e) => e.key === "Enter" && void save()} ariaLabel={kit.fields.amount} autoFocus />
        <button type="button" className="dash-btn is-primary" onClick={() => void save()}>{kit.save}</button>
        <button type="button" className="dash-btn" onClick={onDone}>{kit.cancel}</button>
      </div>
    </div>
  );
}

/** "Tahsilat": what is waiting, what is late, the next payments, record a payment, ask for a reminder draft */
export function PaymentsCard() {
  const ex = useExpand();
  const payments = useQuery<List<Payment>>("/payments?unpaid=true", drained);
  const report = useQuery<Report>("/report");
  const canAsk = useCanAsk();
  const [group, setGroup] = useState<PaymentGroup | null>(null);
  const [paying, setPaying] = useState(false);
  if (isMissing(payments.error)) return null;
  const today = todayIso();
  const all = payments.data?.rows ?? [];
  const withGroup = all.map((p) => ({ p, g: paymentGroup(p, today) }));
  const sum = (g?: PaymentGroup) => withGroup.filter((x) => !g || x.g === g).reduce((s, x) => s + remaining(x.p), 0);
  const late = withGroup.filter((x) => x.g === "late");
  const shown = withGroup.filter((x) => !group || x.g === group).slice(0, SHOWN.payments);
  const rows: ExRow[] = withGroup.map(({ p, g }) => ({
    key: p.id, lead: initials(p.project_name), title: p.project_name, sub: `${MILESTONE[p.milestone] ?? p.milestone} · ${dueText(p, today)}`, right: lira(remaining(p)),
    rightCls: g === "late" ? "text-danger-soft" : undefined, tag: PAYMENT_GROUPS.find((x) => x.key === g)!.label, dot: PAYMENT_GROUPS.find((x) => x.key === g)!.dot, href: `${PROJECTS_PATH}/${p.project_id}`,
  }));

  return (
    <>
      <Card title={m.card.title} count={m.card.count(all.length)} onExpand={(r) => ex.show("payments", r)} className="dash-gap-7 rise">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-currency font-light text-text-muted">{kit.lira}</span>
            <span className="text-display leading-none tracking-kpi">{fmtNum(sum())}</span>
            <span className="text-base text-text-secondary">{m.card.waiting}</span>
          </div>
          {late.length ? <span className="text-base-sm text-danger-soft">{m.card.overdue(lira(sum("late")), late.length)}</span> : null}
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
          {shown.length === 0 ? <p className="m-0 border-t border-border-subtle py-5 text-base-sm text-text-muted">{group ? m.card.noneInGroup : m.card.none}</p> : null}
          {shown.map(({ p, g }) => (
            <div key={p.id} className="flex items-center gap-4 border-t border-border-subtle py-4">
              <div className="flex min-w-0 flex-grow flex-col">
                <span className="truncate text-base">{p.project_name}</span>
                <span className={`text-sm ${g === "late" ? "text-danger-soft" : "text-text-secondary"}`}>{MILESTONE[p.milestone] ?? p.milestone} · {dueText(p, today)}</span>
              </div>
              <span className={`flex-none font-mono text-base ${g === "late" ? "text-danger-soft" : ""}`}>{lira(remaining(p))}</span>
              {g === "late" && canAsk(reminderRequest(p.project_id, p.project_name)) ? <AskButton request={reminderRequest(p.project_id, p.project_name)} className="dash-btn is-claude is-small flex-none" label={m.card.remind} askedLabel={m.ask.requested} /> : null}
            </div>
          ))}
        </div>
        {paying ? <PayForm list={all} onDone={() => setPaying(false)} /> : (
          <button type="button" className="dash-btn is-wide mt-auto" disabled={!all.length} onClick={() => setPaying(true)}>{m.card.record}</button>
        )}
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: m.card.title, sub: m.card.overlaySub(lira(sum()), lira(sum("late"))), page: m.card.pageName, href: PROJECTS_PATH, foot: report.data ? m.card.collectedThisMonth(lira(report.data.month.collected)) : "", rows }} />
    </>
  );
}
