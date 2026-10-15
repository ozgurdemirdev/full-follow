import type { ReactNode } from "react";
import type { NetworkSettings } from "../../api/types";
import { AutoNumber, ControlSkeleton, DAY_SUFFIX } from "../../components/settings/Fields";
import { putSettings, useNetworkCfg, type SettingRow } from "../../lib/settings";

type DayKey = "reply_wait_days" | "cooling_days";

/** Reads the network settings and hands them to a field; renders nothing when the network module is absent */
function WithNetwork({ children }: { children: (cfg: NetworkSettings, reload: () => Promise<unknown>) => ReactNode }) {
  const { cfg, loading, reload } = useNetworkCfg();
  if (!cfg) return loading ? <ControlSkeleton /> : null;
  return <>{children(cfg, reload)}</>;
}

const DaysField = ({ field, label }: { field: DayKey; label: string }) => (
  <WithNetwork>
    {(cfg, reload) => <AutoNumber server={cfg[field]} save={(n) => putSettings({ [field]: n })} settle={reload} label={label} min={1} suffix={DAY_SUFFIX} />}
  </WithNetwork>
);

export function followRows(): SettingRow[] {
  return [
    {
      id: "reply_wait_days",
      name: "Cevap bekleme süresi",
      hint: "Bu kadar gün cevap gelmezse kişi Dashboard’da öne çıkar",
      keywords: ["bekleme", "cevap"],
      control: <DaysField field="reply_wait_days" label="Cevap bekleme süresi" />,
    },
    {
      id: "cooling_days",
      name: "Soğuma eşiği",
      hint: "Bu kadar gün temas yoksa kişi soğuyor sayılır",
      keywords: ["soğuma", "soğuyor", "temas"],
      control: <DaysField field="cooling_days" label="Soğuma eşiği" />,
    },
  ];
}
