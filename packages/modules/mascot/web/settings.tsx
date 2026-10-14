import { SetPills, Switch } from "@kit/components/settings/Parts";
import { toast } from "@kit/components/toast";
import type { SettingRow } from "@kit/lib/settings";
import { MASCOT_TEXT as T } from "./text";
import { SIZE, VARIANTS, VARIANT_IDS } from "./config";
import { mascotPrefs, useMascotPrefs } from "./mascotStore";
import { PRESET_IDS, PRESET_NAMES } from "./palette";

/** What a swatch shows: the bell colour token of the preset */
const swatchColor = (id: string) => `var(--color-mascot-${id}-bell)`;
/** The colour picker starts at the amber token */
const defaultCustom = () => getComputedStyle(document.documentElement).getPropertyValue("--color-mascot-amber-bell").trim();

const ShowSwitch = () => <Switch label={T.show} on={useMascotPrefs().show} onChange={mascotPrefs.setShow} />;
const WanderSwitch = () => <Switch label={T.wander} on={useMascotPrefs().wander} onChange={mascotPrefs.setWander} />;

function ModelPills() {
  const p = useMascotPrefs();
  return <SetPills label={T.model} items={VARIANT_IDS.map((id) => ({ value: id, label: VARIANTS[id].name }))} value={p.variant} onChange={mascotPrefs.setVariant} />;
}

function Swatches() {
  const p = useMascotPrefs();
  return (
    <span className="set-swatches">
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
    </span>
  );
}

function SizeRange() {
  const p = useMascotPrefs();
  return <input type="range" className="set-range" aria-label={T.size} min={SIZE.min} max={SIZE.max} step={SIZE.step} value={p.size} onChange={(e) => mascotPrefs.setSize(Number(e.target.value))} />;
}

const ResetPosition = () => (
  <button
    type="button"
    className="set-btn"
    onClick={() => {
      mascotPrefs.resetPosition();
      toast(T.resetDone);
    }}
  >
    {T.resetPosition}
  </button>
);

/** Every control changes the running mascot at once (mascotStore) and survives F5 */
export const mascotRows = (): SettingRow[] => [
  { id: "mascot-show", name: T.show, hint: T.showHint, keywords: ["maskot", "denizanası", "gizle"], control: <ShowSwitch /> },
  { id: "mascot-wander", name: T.wander, hint: T.wanderHint, keywords: ["maskot", "gezinme"], control: <WanderSwitch /> },
  { id: "mascot-model", name: T.model, keywords: ["maskot", "yuvarlak", "klasik", "etekli"], control: <ModelPills /> },
  { id: "mascot-color", name: T.color, keywords: ["maskot", "özel renk"], control: <Swatches /> },
  { id: "mascot-size", name: T.size, keywords: ["maskot", "boyut", "büyüklük"], control: <SizeRange /> },
  { id: "mascot-position", name: "Konum", hint: "Maskotu varsayılan yerine geri koyar", keywords: ["maskot", "sıfırla"], control: <ResetPosition /> },
];
