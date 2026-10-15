import { useState } from "react";
import { NumberField } from "@kit/components/NumberField";
import { ControlSkeleton } from "@kit/components/settings/Fields";
import type { PriceFloor } from "@kit/api/types";
import { MILESTONE } from "@kit/lib/labels";
import { putSettings, useSettings } from "@kit/lib/settings";
import { PERCENT, TEMPLATE_TOTAL_PERCENT } from "../constants";
import { m } from "../messages";
import { m as kit } from "@kit/messages";

type Rows = PriceFloor["payment_template"];

/** Payment template: the percentages must add up to 100, so it saves with a button instead of autosave */
export function TemplateEditor() {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  // the editor restarts when the saved template changes
  return <Editor key={JSON.stringify(s.data.payment_template)} saved={s.data.payment_template} />;
}

function Editor({ saved }: { saved: Rows }) {
  const [rows, setRows] = useState<Rows>(() => saved.map((r) => ({ ...r })));
  const [busy, setBusy] = useState(false);
  const sum = rows.reduce((a, r) => a + (Number(r.percent) || 0), 0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const used = new Set(rows.map((r) => r.milestone));
  const free = Object.keys(MILESTONE).filter((x) => !used.has(x));
  const set = (i: number, patch: Partial<Rows[number]>) => setRows((p) => p.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    try {
      await putSettings({ payment_template: rows }, m.settings.templateSaved);
    } catch {
      /* the toast is shown inside run() */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="set-template">
      {rows.map((r, i) => (
        <div key={r.milestone} className="set-template-row">
          <span className="set-template-name">{MILESTONE[r.milestone] ?? r.milestone}</span>
          <label className="set-template-unit">{m.common.percent}
            <NumberField className="set-input set-input-num" min={1} max={PERCENT} value={r.percent} ariaLabel={m.settings.percentLabel(MILESTONE[r.milestone])} onChange={(v) => set(i, { percent: v ?? 0 })} />
          </label>
          <label className="set-template-unit">
            <NumberField className="set-input set-input-num" min={0} value={r.days} ariaLabel={m.settings.daysLabel(MILESTONE[r.milestone])} onChange={(v) => set(i, { days: v ?? 0 })} />{m.common.days}
          </label>
          <button type="button" className="set-icon-btn" aria-label={m.settings.removeRow} disabled={rows.length < 2} onClick={() => setRows((p) => p.filter((_, k) => k !== i))}>×</button>
        </div>
      ))}
      <div className="set-template-foot">
        {free.length ? (
          <select className="set-input" aria-label={m.settings.addStage} value="" onChange={(e) => e.target.value && setRows((p) => [...p, { milestone: e.target.value, percent: 0, days: 0 }])}>
            <option value="">{m.settings.addStage}</option>
            {free.map((x) => <option key={x} value={x}>{MILESTONE[x]}</option>)}
          </select>
        ) : null}
        <span className="set-template-sum" data-ok={sum === TEMPLATE_TOTAL_PERCENT ? "" : undefined}>{m.settings.total(sum)}</span>
        {dirty ? <button type="button" className="set-btn" onClick={() => setRows(saved.map((r) => ({ ...r })))}>{kit.undo}</button> : null}
        <button type="button" className="set-btn" data-primary="" disabled={busy || !dirty || sum !== TEMPLATE_TOTAL_PERCENT} onClick={save}>{kit.save}</button>
      </div>
    </div>
  );
}
