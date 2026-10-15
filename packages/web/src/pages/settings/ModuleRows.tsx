import { setHiddenModules, useModules } from "../../api/modules";
import { moduleLabels } from "../../app/modules/registry";
import { Switch } from "../../components/settings/Parts";
import { putSettings, words, type SettingRow } from "../../lib/settings";
import { settings } from "../../messages.settings";

const msg = settings.modules;

/** One module's on/off switch: hiding is instant (optimistic), a failed save puts the switch back; the setting keeps only the hidden keys */
function ModuleSwitch({ moduleKey, label }: { moduleKey: string; label: string }) {
  const { hidden } = useModules();
  const toggle = (shown: boolean) => {
    const before = [...hidden];
    const after = shown ? before.filter((k) => k !== moduleKey) : [...before, moduleKey];
    setHiddenModules(after);
    putSettings({ modules_hidden: after }, shown ? msg.shown(label) : msg.hidden(label)).catch(() => setHiddenModules(before));
  };
  return <Switch label={msg.show(label)} on={!hidden.has(moduleKey)} onChange={toggle} />;
}

/** The "Modüller" rows: one per installed module with its Turkish name (the manifest's `label`) */
export const moduleRows = (installed: (key: string) => boolean): SettingRow[] =>
  moduleLabels().filter((m) => installed(m.key)).map((m) => ({
    id: `module-${m.key}`,
    name: m.label,
    keywords: [...words(msg.keywords), m.key],
    control: <ModuleSwitch moduleKey={m.key} label={m.label} />,
  }));
