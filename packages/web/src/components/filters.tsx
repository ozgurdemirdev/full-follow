// Kişi ve firma listelerinde ortak filtre: etiket, sektör, nereden buldum, temas durumu
import { pickable, useSectors, useSources, useTags } from "../api/keys";
import type { Labeled, Sector } from "../api/types";
import { CONTACT_STATUS, CONTACT_STATUSES } from "../lib/labels";
import { usePopover } from "../lib/usePopover";
import { m as kit } from "../messages";
import { parts } from "../messages.parts";

const m = parts.filters;

export interface LabelFilter {
  tag: string;
  sector: string;
  source: string;
  status: string;
}
export const noFilter: LabelFilter = { tag: "", sector: "", source: "", status: "" };

/** Ana sektör seçilince alt sektörleri de kapsar */
export function matchLabels(r: Labeled, f: LabelFilter, sectors: Sector[]): boolean {
  if (f.tag && !r.tag_ids.includes(Number(f.tag))) return false;
  if (f.source && r.source_id !== Number(f.source)) return false;
  if (f.status && r.contact_status !== f.status) return false;
  if (f.sector) {
    const sid = Number(f.sector);
    const ids = new Set([sid, ...sectors.filter((s) => s.parent_id === sid).map((s) => s.id)]);
    if (!r.sectors.some((s) => ids.has(s.id))) return false;
  }
  return true;
}

export function LabelFilters({ value, onChange, counts }: { value: LabelFilter; onChange: (v: LabelFilter) => void; counts?: Record<string, number> }) {
  const tags = useTags();
  const sectors = useSectors();
  const sources = useSources();
  const set = (k: keyof LabelFilter) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  const active = Object.values(value).some(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={m.group}>
      <select className="inp w-auto" aria-label={m.status} value={value.status} onChange={set("status")}>
        <option value="">{m.allStatuses}</option>
        {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{CONTACT_STATUS[s]}{counts?.[s] ? m.count(counts[s]) : ""}</option>)}
      </select>
      <select className="inp w-auto" aria-label={m.tag} value={value.tag} onChange={set("tag")}>
        <option value="">{m.allTags}</option>
        {pickable(tags.rows).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select className="inp w-auto" aria-label={m.sector} value={value.sector} onChange={set("sector")}>
        <option value="">{m.allSectors}</option>
        {pickable(sectors.rows).map((s) => <option key={s.id} value={s.id}>{s.parent_id ? `· ${s.name}` : s.name}</option>)}
      </select>
      <select className="inp w-auto" aria-label={m.source} value={value.source} onChange={set("source")}>
        <option value="">{m.allSources}</option>
        {pickable(sources.rows).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {active ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(noFilter)}>{kit.clear}</button> : null}
    </div>
  );
}

/** The tag, sector, source and status filters of the people and company lists, behind one pill */
export function MoreFilters({ value, onChange }: { value: LabelFilter; onChange: (v: LabelFilter) => void }) {
  const { open, setOpen, root } = usePopover();
  const active = Object.values(value).filter(Boolean).length;
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-chan ppl-filter" data-on={active > 0} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {active ? m.pillCount(active) : m.pill}
      </button>
      <div role="dialog" aria-label={m.pill} aria-hidden={!open} className="ppl-pop" inert={!open}>
        <LabelFilters value={value} onChange={onChange} />
        {active ? <button type="button" className="ppl-pop-item" onClick={() => onChange(noFilter)}>{m.clearAll}</button> : null}
      </div>
    </div>
  );
}
