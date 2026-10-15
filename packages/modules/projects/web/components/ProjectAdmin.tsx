import { useState } from "react";
import { run } from "@kit/api/actions";
import type { ProjectRow } from "../types";
import { PROJECT_STAGE, type ProjectStage } from "@kit/lib/labels";
import { NumberField } from "@kit/components/NumberField";
import { m } from "../messages";

const STAGES = Object.keys(PROJECT_STAGE) as ProjectStage[];

/** What the board leaves out: move the project to another stage and set the monthly maintenance fee */
export function ProjectAdmin({ p }: { p: ProjectRow }) {
  const [fee, setFee] = useState<number | null>(p.maintenance_fee);
  const move = (stage: ProjectStage) => {
    if (stage === "iptal" && !confirm(m.confirmCancel)) return;
    void run("post", `/projects/${p.id}/move`, { stage }, { ok: m.stageSet(PROJECT_STAGE[stage]) }).catch(() => {});
  };
  const saveFee = () => void run("patch", `/projects/${p.id}`, { maintenance_fee: fee }, { ok: m.admin.feeSaved }).catch(() => {});
  return (
    <div className="prj-sec" data-gap="loose">
      <span className="prj-sec-label">{m.shared.stage}</span>
      <select className="inp" aria-label={m.shared.stage} value={p.stage} onChange={(e) => move(e.target.value as ProjectStage)}>
        {STAGES.map((s) => <option key={s} value={s}>{PROJECT_STAGE[s]}</option>)}
      </select>
      <span className="prj-sec-label">{m.admin.fee}</span>
      <div className="prj-fee">
        <NumberField className="inp inp-num" min={0} value={fee} onChange={setFee} ariaLabel={m.admin.feeLabel} placeholder={m.admin.feePlaceholder}
          onKeyDown={(e) => e.key === "Enter" && fee !== p.maintenance_fee && saveFee()} />
        <button type="button" className="dash-btn is-small" disabled={fee === p.maintenance_fee} onClick={saveFee}>{m.shared.save}</button>
      </div>
    </div>
  );
}
