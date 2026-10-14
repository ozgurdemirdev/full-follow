import { toast } from "../../components/toast";
import { order, Segmented } from "../../components/ui";
import { MASCOT_TEXT as T } from "../../lib/mascotText";
import { SIZE, VARIANTS, VARIANT_IDS } from "../../mascot/config";
import { mascotPrefs, useMascotPrefs } from "../../mascot/mascotStore";
import { PRESET_IDS, PRESET_NAMES } from "../../mascot/palette";
import { Head } from "./Head";

/** What a swatch shows: the bell colour token of the preset */
const swatchColor = (id: string) => `var(--color-mascot-${id}-bell)`;
/** The colour picker starts at the amber token */
const defaultCustom = () => getComputedStyle(document.documentElement).getPropertyValue("--color-mascot-amber-bell").trim();

function Switch({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set-toggle">
      <span data-setting={label}>
        {label}
        <small>{hint}</small>
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="set-switch" onClick={() => onChange(!on)} />
    </div>
  );
}

/** Mascot settings: every control changes the running mascot at once (mascotStore) and survives F5 */
export function MascotCard() {
  const p = useMascotPrefs();
  return (
    <section className="card rise flex flex-col gap-6 px-9 py-8" style={order(0)} aria-label={T.title}>
      <Head title={T.title} />
      <p className="m-0 text-base-sm text-text-secondary">{T.intro}</p>
      <Switch label={T.show} hint={T.showHint} on={p.show} onChange={mascotPrefs.setShow} />
      <Switch label={T.wander} hint={T.wanderHint} on={p.wander} onChange={mascotPrefs.setWander} />
      <div className="flex flex-col gap-3">
        <span className="lab" data-setting={T.model}>{T.model}</span>
        <Segmented
          label={T.model}
          items={VARIANT_IDS.map((id) => VARIANTS[id].name)}
          value={Math.max(0, VARIANT_IDS.indexOf(p.variant))}
          onChange={(i) => mascotPrefs.setVariant(VARIANT_IDS[i])}
        />
      </div>
      <div className="flex flex-col gap-3">
        <span className="lab" data-setting={T.color}>{T.color}</span>
        <div className="flex flex-wrap items-center gap-4">
          {PRESET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="set-swatch"
              aria-pressed={p.color === id}
              aria-label={PRESET_NAMES[id]}
              title={PRESET_NAMES[id]}
              style={{ background: swatchColor(id) }}
              onClick={() => mascotPrefs.setColor(id)}
            />
          ))}
          <label className="set-swatch set-swatch-custom" title={T.customColor} aria-pressed={p.color === "custom"} style={p.color === "custom" && p.custom ? { background: p.custom } : undefined}>
            <input type="color" aria-label={T.customColor} value={p.custom ?? defaultCustom()} onChange={(e) => mascotPrefs.setCustom(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <label htmlFor="set-mascot-size" className="lab" data-setting={T.size}>{T.size}</label>
        <input id="set-mascot-size" type="range" className="set-range" min={SIZE.min} max={SIZE.max} step={SIZE.step} value={p.size} onChange={(e) => mascotPrefs.setSize(Number(e.target.value))} />
      </div>
      <div>
        <button
          type="button"
          className="btn btn-sec"
          onClick={() => {
            mascotPrefs.resetPosition();
            toast(T.resetDone);
          }}
        >
          {T.resetPosition}
        </button>
      </div>
    </section>
  );
}
