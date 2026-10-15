import { AutoNumber, ControlSkeleton, DAY_SUFFIX, WithNetworkCfg } from "@kit/components/settings/Fields";
import { putSettings, useNetworkCfg, type SettingRow, words } from "@kit/lib/settings";
import { m } from "./messages";

const TARGET_STEP = 5;

type DayKey = "reply_wait_days" | "cooling_days";

const DaysField = ({ field, label }: { field: DayKey; label: string }) => (
  <WithNetworkCfg>
    {(cfg, reload) => <AutoNumber server={cfg[field]} save={(n) => putSettings({ [field]: n })} settle={reload} label={label} min={1} suffix={DAY_SUFFIX} />}
  </WithNetworkCfg>
);

/** The first two rows of the "Takip kuralları" category: how long a reply may take and when a contact counts as cooling */
export const followWaitRows = (): SettingRow[] => [
  {
    id: "reply_wait_days",
    name: m.settings.replyWait,
    hint: m.settings.replyWaitHint,
    keywords: words(m.settings.replyWaitKeywords),
    control: <DaysField field="reply_wait_days" label={m.settings.replyWait} />,
  },
  {
    id: "cooling_days",
    name: m.settings.cooling,
    hint: m.settings.coolingHint,
    keywords: words(m.settings.coolingKeywords),
    control: <DaysField field="cooling_days" label={m.settings.cooling} />,
  },
];

/** Weekly outgoing message target; 0 means no target */
function WeeklyTarget() {
  const { cfg, loading, reload } = useNetworkCfg();
  if (!cfg) return loading ? <ControlSkeleton /> : null;
  return <AutoNumber server={cfg.weekly_target || null} save={(n) => putSettings({ weekly_target: n })} settle={reload} label={m.settings.target} nullable min={0} step={TARGET_STEP} placeholder={m.settings.targetPlaceholder} />;
}

/** The weekly target row of the business category */
export const weeklyTargetRows = (): SettingRow[] => [{
  id: "weekly-target",
  name: m.settings.target,
  hint: m.settings.targetHint,
  keywords: words(m.settings.targetKeywords),
  control: <WeeklyTarget />,
}];
