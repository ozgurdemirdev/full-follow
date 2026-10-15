import { AutoNumber, AutoText, WithNetworkCfg } from "@kit/components/settings/Fields";
import { SetChip, Switch } from "@kit/components/settings/Parts";
import { toast } from "@kit/components/toast";
import { QUOTA_CHANNELS } from "./labels";
import { m } from "./messages";
import { channelName } from "@kit/lib/network";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";

const LIMIT_STEP = 5;

/** Rules Claude learned from rejected drafts; deleting one writes the rest back */
function RuleChips() {
  const s = useSettings();
  const rules = s.data?.draft_rules;
  if (!rules) return null;
  if (!rules.length) return <span className="set-row-hint">{m.settings.noRules}</span>;
  return (
    <span className="set-chips">
      {rules.map((rule, i) => (
        <SetChip key={rule} dot={<i className="set-dot set-dot-accent" />} removeLabel={m.settings.removeRule(rule)} remove={() => void putSettings({ draft_rules: rules.filter((_, k) => k !== i) }, m.settings.ruleDeleted).catch(() => {})}>
          {rule}
        </SetChip>
      ))}
    </span>
  );
}

/** "3, 7": days after an unanswered message when Claude prepares a follow-up draft; empty turns it off */
const FollowupDays = () => (
  <WithNetworkCfg>
    {(cfg, reload) => (
      <AutoText
        server={cfg.followup_days.join(", ")}
        label={m.settings.followupName}
        placeholder={m.settings.followupPlaceholder}
        save={(text) => {
          const list = text.split(/[,\s]+/).filter(Boolean).map(Number);
          return putSettings({ followup_days: list }, list.length ? m.settings.followupSaved : m.settings.followupOff);
        }}
        settle={reload}
      />
    )}
  </WithNetworkCfg>
);

const ChannelLimit = ({ channel }: { channel: string }) => (
  <WithNetworkCfg>
    {(cfg, reload) => (
      <AutoNumber
        server={cfg.channel_limits[channel] || null}
        label={m.settings.limitName(channelName(channel))}
        placeholder={m.settings.limitPlaceholder}
        nullable
        min={0}
        step={LIMIT_STEP}
        save={(n) => putSettings({ channel_limits: { ...cfg.channel_limits, [channel]: n } })}
        settle={reload}
      />
    )}
  </WithNetworkCfg>
);

const Warmup = () => (
  <WithNetworkCfg>
    {(cfg, reload) => (
      <AutoText
        type="date"
        server={cfg.email_warmup_until}
        label={m.settings.warmupName}
        save={(date) => putSettings({ email_warmup_until: date }, date ? m.settings.warmupSaved : m.settings.warmupOff)}
        settle={reload}
      />
    )}
  </WithNetworkCfg>
);

/** The follow-up sequence row of the "Takip kuralları" category */
export const followupRows = (): SettingRow[] => [{
  id: "followup_days",
  name: m.settings.followupName,
  hint: m.settings.followupHint,
  keywords: m.settings.followupKeywords.split(","),
  control: <FollowupDays />,
}];

/** The daily send limits and the cold email warmup of the "Takip kuralları" category */
export const quotaRows = (): SettingRow[] => [
  ...QUOTA_CHANNELS.map((c, i) => ({
    id: `limit-${c}`,
    name: m.settings.limitName(channelName(c)),
    hint: i === 0 ? m.settings.limitFirstHint : m.settings.limitHint,
    keywords: m.settings.limitKeywords.split(","),
    control: <ChannelLimit channel={c} />,
  })),
  {
    id: "email_warmup_until",
    name: m.settings.warmupName,
    hint: m.settings.warmupHint,
    keywords: m.settings.warmupKeywords.split(","),
    control: <Warmup />,
  },
];

/** The rows of the "Claude" category that belong to drafts: sending without asking stays locked, and the rules learned from rejected drafts */
export const draftClaudeRows = (ctx: { hasRules: boolean }): SettingRow[] => [
  {
    id: "auto-send",
    name: m.settings.autoSendName,
    hint: m.settings.autoSendHint,
    keywords: m.settings.autoSendKeywords.split(","),
    control: <Switch label={m.settings.autoSendName} on={false} locked onLockedClick={() => toast(m.settings.lockedToast)} />,
  },
  ...(ctx.hasRules
    ? [{ id: "draft-rules", name: m.settings.rulesName, hint: m.settings.rulesHint, keywords: m.settings.rulesKeywords.split(","), wide: true, control: <RuleChips /> }]
    : []),
];
