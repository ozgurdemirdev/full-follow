import { AutoNumber, ControlSkeleton, DAY_SUFFIX, WithNetwork } from "@kit/components/settings/Fields";
import { putSettings, useNetworkCfg, type SettingRow } from "@kit/lib/settings";

const TARGET_STEP = 5;

type DayKey = "reply_wait_days" | "cooling_days";

const DaysField = ({ field, label }: { field: DayKey; label: string }) => (
  <WithNetwork>
    {(cfg, reload) => <AutoNumber server={cfg[field]} save={(n) => putSettings({ [field]: n })} settle={reload} label={label} min={1} suffix={DAY_SUFFIX} />}
  </WithNetwork>
);

/** The first two rows of the "Takip kuralları" category: how long a reply may take and when a contact counts as cooling */
export const followWaitRows = (): SettingRow[] => [
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

/** Weekly outgoing message target; 0 means no target */
function WeeklyTarget() {
  const { cfg, loading, reload } = useNetworkCfg();
  if (!cfg) return loading ? <ControlSkeleton /> : null;
  return <AutoNumber server={cfg.weekly_target || null} save={(n) => putSettings({ weekly_target: n })} settle={reload} label="Haftalık giden mesaj hedefi" nullable min={0} step={TARGET_STEP} placeholder="hedef yok" />;
}

/** The weekly target row of the business category */
export const weeklyTargetRows = (): SettingRow[] => [{
  id: "weekly-target",
  name: "Haftalık giden mesaj hedefi",
  hint: "Dashboard’da bu haftanın ilerlemesi görünür. Boş ya da 0 = hedef yok",
  keywords: ["hedef", "linkedin", "mesaj"],
  control: <WeeklyTarget />,
}];
