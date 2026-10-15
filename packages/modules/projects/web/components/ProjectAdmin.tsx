import { useState } from "react";
import { run } from "@kit/api/actions";
import type { ProjectRow } from "../types";
import { PROJECT_STAGE, type ProjectStage } from "@kit/lib/labels";
import { NumberField } from "@kit/components/NumberField";

const STAGES = Object.keys(PROJECT_STAGE) as ProjectStage[];

/** What the board leaves out: move the project to another stage and set the monthly maintenance fee */
export function ProjectAdmin({ p }: { p: ProjectRow }) {
  const [fee, setFee] = useState<number | null>(p.maintenance_fee);
  const move = (stage: ProjectStage) => {
    if (stage === "iptal" && !confirm("Proje iptal edilsin mi?")) return;
    void run("post", `/projects/${p.id}/move`, { stage }, { ok: `Aşama: ${PROJECT_STAGE[stage]}` }).catch(() => {});
  };
  const saveFee = () => void run("patch", `/projects/${p.id}`, { maintenance_fee: fee }, { ok: "Bakım ücreti kaydedildi" }).catch(() => {});
  return (
    <div className="prj-sec" data-gap="loose">
      <span className="prj-sec-label">Aşama</span>
      <select className="inp" aria-label="Aşama" value={p.stage} onChange={(e) => move(e.target.value as ProjectStage)}>
        {STAGES.map((s) => <option key={s} value={s}>{PROJECT_STAGE[s]}</option>)}
      </select>
      <span className="prj-sec-label">Bakım ücreti (aylık)</span>
      <div className="prj-fee">
        <NumberField className="inp inp-num" min={0} value={fee} onChange={setFee} ariaLabel="Bakım ücreti" placeholder="Yok"
          onKeyDown={(e) => e.key === "Enter" && fee !== p.maintenance_fee && saveFee()} />
        <button type="button" className="dash-btn is-small" disabled={fee === p.maintenance_fee} onClick={saveFee}>Kaydet</button>
      </div>
    </div>
  );
}
