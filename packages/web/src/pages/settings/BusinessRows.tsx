import { AutoNumber, ControlSkeleton } from "../../components/settings/Fields";
import type { SettingsEntry } from "../../app/modules/types";
import { putSettings, useNetworkCfg } from "../../lib/settings";

const TARGET_STEP = 5;

/** Weekly outgoing message target; 0 means no target */
function WeeklyTarget() {
  const { cfg, loading, reload } = useNetworkCfg();
  if (!cfg) return loading ? <ControlSkeleton /> : null;
  return <AutoNumber server={cfg.weekly_target || null} save={(n) => putSettings({ weekly_target: n })} settle={reload} label="Haftalık giden mesaj hedefi" nullable min={0} step={TARGET_STEP} placeholder="hedef yok" />;
}

/** The rows of the business category the kit keeps; the modules' rows (the report's money and floor, order 10, the calendar's daily goals, 30, the payment template, 40) slot in around it by `order` */
export const businessEntries: SettingsEntry[] = [
  {
    id: "business-weekly-target",
    category: "isletme",
    order: 20,
    rows: () => [{
      id: "weekly-target",
      name: "Haftalık giden mesaj hedefi",
      hint: "Dashboard’da bu haftanın ilerlemesi görünür. Boş ya da 0 = hedef yok",
      keywords: ["hedef", "linkedin", "mesaj"],
      control: <WeeklyTarget />,
    }],
  },
];
