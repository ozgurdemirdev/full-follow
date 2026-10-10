import { useState } from "react";
import { pickable, useSectors } from "../api/keys";

/**
 * Sectors in two steps: pick a main sector, then (optionally) its sub-sectors.
 * A sub-sector stands in for its parent, so choosing one drops the parent from the value.
 * Missing sectors are typed in and sent as "Main > Sub" text; core creates them.
 */
export function SectorPicker({ value, onChange, id }: { value: (number | string)[]; onChange: (v: (number | string)[]) => void; id: string }) {
  const sectors = useSectors();
  const ids = value.filter((v): v is number => typeof v === "number");
  const pending = value.filter((v): v is string => typeof v === "string");
  const options = pickable(sectors.rows, ids);
  const mains = options.filter((s) => !s.parent_id);
  const subsOf = (mainId: number) => options.filter((s) => s.parent_id === mainId);
  const [open, setOpen] = useState<number | null>(null);
  const [main, setMain] = useState("");
  const [sub, setSub] = useState("");
  const same = (a: string, b: string) => a.toLocaleLowerCase("tr") === b.toLocaleLowerCase("tr");
  const pickedSubs = (mainId: number) => subsOf(mainId).filter((s) => ids.includes(s.id));

  const toggleMain = (m: (typeof mains)[number]) => {
    if (pickedSubs(m.id).length) return setOpen(open === m.id ? null : m.id);
    if (ids.includes(m.id)) {
      onChange(value.filter((v) => v !== m.id));
      setOpen(null);
    } else {
      onChange([...value, m.id]);
      setOpen(m.id);
    }
  };
  const toggleSub = (s: (typeof options)[number]) =>
    onChange(ids.includes(s.id) ? value.filter((v) => v !== s.id) : [...value.filter((v) => v !== s.parent_id), s.id]);
  const addMain = () => {
    const t = main.trim();
    if (!t) return;
    const hit = mains.find((m) => same(m.name, t));
    if (hit) {
      if (!ids.includes(hit.id) && !pickedSubs(hit.id).length) onChange([...value, hit.id]);
      setOpen(hit.id);
    } else if (!pending.some((x) => same(x, t))) onChange([...value, t]);
    setMain("");
  };
  const addSub = (m: (typeof mains)[number]) => {
    const t = sub.trim();
    if (!t) return;
    const hit = subsOf(m.id).find((s) => same(s.name, t));
    const v = hit ? hit.id : `${m.name} > ${t}`;
    if (!value.includes(v)) onChange([...value.filter((x) => x !== m.id), v]);
    setSub("");
  };
  const opened = mains.find((m) => m.id === open);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3" role="group" aria-label="Ana sektörler">
        {mains.map((m) => {
          const n = pickedSubs(m.id).length;
          return (
            <button key={m.id} type="button" aria-pressed={ids.includes(m.id) || n > 0} aria-expanded={open === m.id} onClick={() => toggleMain(m)}
              className="fchip h-control-height-xs">
              {m.name}{n ? ` · ${n}` : ""}
            </button>
          );
        })}
        {pending.map((v) => (
          <button key={v} type="button" className="fchip h-control-height-xs" aria-pressed="true" onClick={() => onChange(value.filter((x) => x !== v))} title="Kaldır">
            {v} ×
          </button>
        ))}
      </div>
      {opened ? (
        <div className="inset flex flex-col gap-3 p-5">
          <span className="text-sm text-text-secondary">{opened.name} alt sektörleri (isteğe bağlı)</span>
          {subsOf(opened.id).length ? (
            <div className="flex flex-wrap gap-3" role="group" aria-label={`${opened.name} alt sektörleri`}>
              {subsOf(opened.id).map((s) => (
                <button key={s.id} type="button" aria-pressed={ids.includes(s.id)} onClick={() => toggleSub(s)} className="fchip h-control-height-xs">{s.name}</button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input className="inp min-w-0 flex-1" placeholder="Yeni alt sektör (ör. Motion designer)" aria-label="Yeni alt sektör" value={sub}
              onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub(opened))} />
            <button type="button" className="btn btn-sec" disabled={!sub.trim()} onClick={() => addSub(opened)}>Ekle</button>
          </div>
        </div>
      ) : null}
      <div className="flex gap-3">
        <input id={id} className="inp min-w-0 flex-1" placeholder="Yeni ana sektör (ör. Sağlık)" value={main}
          onChange={(e) => setMain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMain())} />
        <button type="button" className="btn btn-sec" disabled={!main.trim()} onClick={addMain}>Ekle</button>
      </div>
    </div>
  );
}
