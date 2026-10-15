import { setHiddenModules, useModules } from "../../api/modules";
import { moduleLabels } from "../../app/modules/registry";
import { Switch } from "../../components/settings/Parts";
import { putSettings, type SettingRow } from "../../lib/settings";

/** One module's on/off switch: hiding is instant (optimistic), a failed save puts the switch back; the setting keeps only the hidden keys */
function ModuleSwitch({ moduleKey, label }: { moduleKey: string; label: string }) {
  const { hidden } = useModules();
  const toggle = (shown: boolean) => {
    const before = [...hidden];
    const after = shown ? before.filter((k) => k !== moduleKey) : [...before, moduleKey];
    setHiddenModules(after);
    putSettings({ modules_hidden: after }, shown ? `${label} gösteriliyor` : `${label} gizlendi`).catch(() => setHiddenModules(before));
  };
  return <Switch label={`${label} göster`} on={!hidden.has(moduleKey)} onChange={toggle} />;
}

/** The "Modüller" rows: one per installed module with its Turkish name (the manifest's `label`) */
export const moduleRows = (installed: (key: string) => boolean): SettingRow[] =>
  moduleLabels().filter((m) => installed(m.key)).map((m) => ({
    id: `module-${m.key}`,
    name: m.label,
    keywords: ["modül", "gizle", "göster", "aç", "kapat", m.key],
    control: <ModuleSwitch moduleKey={m.key} label={m.label} />,
  }));
