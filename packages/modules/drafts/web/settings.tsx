import { AutoNumber, AutoText, WithNetworkCfg } from "@kit/components/settings/Fields";
import { SetChip, Switch } from "@kit/components/settings/Parts";
import { toast } from "@kit/components/toast";
import { QUOTA_CHANNELS } from "./labels";
import { channelName } from "@kit/lib/network";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";

const LIMIT_STEP = 5;
const LOCKED_TOAST = "Bu kapalı kalır, mesajlar hep senin onayınla gider";

/** Rules Claude learned from rejected drafts; deleting one writes the rest back */
function RuleChips() {
  const s = useSettings();
  const rules = s.data?.draft_rules;
  if (!rules) return null;
  if (!rules.length) return <span className="set-row-hint">Henüz öğrendiği kural yok</span>;
  return (
    <span className="set-chips">
      {rules.map((rule, i) => (
        <SetChip key={rule} dot={<i className="set-dot set-dot-accent" />} removeLabel={`${rule} sil`} remove={() => void putSettings({ draft_rules: rules.filter((_, k) => k !== i) }, "Kural silindi").catch(() => {})}>
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
        label="Takip dizisi (gün)"
        placeholder="örn. 3, 7"
        save={(text) => {
          const list = text.split(/[,\s]+/).filter(Boolean).map(Number);
          return putSettings({ followup_days: list }, list.length ? "Takip günleri kaydedildi" : "Otomatik takip kapatıldı");
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
        label={`${channelName(channel)} günlük limit`}
        placeholder="limit yok"
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
        label="Soğuk e-posta ısınma bitişi"
        save={(date) => putSettings({ email_warmup_until: date }, date ? "Isınma tarihi kaydedildi" : "Isınma dönemi kapatıldı")}
        settle={reload}
      />
    )}
  </WithNetworkCfg>
);

/** The follow-up sequence row of the "Takip kuralları" category */
export const followupRows = (): SettingRow[] => [{
  id: "followup_days",
  name: "Takip dizisi (gün)",
  hint: "Cevapsız mesajdan bu kadar gün sonra Claude takip taslağı hazırlar. Boş bırakırsan kapanır",
  keywords: ["takip", "taslak", "hatırlatma"],
  control: <FollowupDays />,
}];

/** The daily send limits and the cold email warmup of the "Takip kuralları" category */
export const quotaRows = (): SettingRow[] => [
  ...QUOTA_CHANNELS.map((c, i) => ({
    id: `limit-${c}`,
    name: `${channelName(c)} günlük limit`,
    hint: i === 0 ? "Dashboard’da bugün gönderilen sayı limitle karşılaştırılır; yaklaşınca ve dolunca uyarı çıkar. Boş ya da 0 = limit yok" : "Boş ya da 0 = limit yok",
    keywords: ["kota", "günlük gönderim limiti", "kanal"],
    control: <ChannelLimit channel={c} />,
  })),
  {
    id: "email_warmup_until",
    name: "Soğuk e-posta ısınma bitişi",
    hint: "Yeni alan adında ilk 2 hafta soğuk e-posta kapalı: bu tarihe kadar daha önce yazılmamış birine e-posta gidince uyarı çıkar. Boş = ısınma yok",
    keywords: ["ısınma", "soğuk e-posta", "alan adı", "tarih"],
    control: <Warmup />,
  },
];

/** The rows of the "Claude" category that belong to drafts: sending without asking stays locked, and the rules learned from rejected drafts */
export const draftClaudeRows = (ctx: { hasRules: boolean }): SettingRow[] => [
  {
    id: "auto-send",
    name: "Taslağı sormadan göndersin",
    hint: "Kapalı kalır: her mesaj senin onayınla gider",
    keywords: ["onay", "gönder", "taslak"],
    control: <Switch label="Taslağı sormadan göndersin" on={false} locked onLockedClick={() => toast(LOCKED_TOAST)} />,
  },
  ...(ctx.hasRules
    ? [{ id: "draft-rules", name: "Öğrendiği kurallar", hint: "Sil dersen bir daha uygulamaz", keywords: ["reddet", "öğren", "kural"], wide: true, control: <RuleChips /> }]
    : []),
];
