import { AutoNumber, AutoText, DAY_SUFFIX, WithNetwork } from "../../components/settings/Fields";
import { QUOTA_CHANNELS } from "../../lib/labels";
import { channelName } from "../../lib/network";
import { putSettings, useSettings, type SettingRow } from "../../lib/settings";

const LIMIT_STEP = 5;

/** "3, 7": days after an unanswered message when Claude prepares a follow-up draft; empty turns it off */
const FollowupDays = () => (
  <WithNetwork>
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
  </WithNetwork>
);

const ChannelLimit = ({ channel }: { channel: string }) => (
  <WithNetwork>
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
  </WithNetwork>
);

const Warmup = () => (
  <WithNetwork>
    {(cfg, reload) => (
      <AutoText
        type="date"
        server={cfg.email_warmup_until}
        label="Soğuk e-posta ısınma bitişi"
        save={(date) => putSettings({ email_warmup_until: date }, date ? "Isınma tarihi kaydedildi" : "Isınma dönemi kapatıldı")}
        settle={reload}
      />
    )}
  </WithNetwork>
);

/** Days after which a post without an interval of its own is due for a refresh */
function PostRefresh() {
  const s = useSettings();
  if (!s.data) return null;
  return <AutoNumber server={s.data.post_refresh_days} save={(n) => putSettings({ post_refresh_days: n })} settle={s.reload} label="Paylaşım güncelleme" min={1} suffix={DAY_SUFFIX} />;
}

export function followRows(): SettingRow[] {
  return [
    {
      id: "followup_days",
      name: "Takip dizisi (gün)",
      hint: "Cevapsız mesajdan bu kadar gün sonra Claude takip taslağı hazırlar. Boş bırakırsan kapanır",
      keywords: ["takip", "taslak", "hatırlatma"],
      control: <FollowupDays />,
    },
    {
      id: "post_refresh_days",
      name: "Paylaşım güncelleme",
      hint: "Kendi aralığı olmayan paylaşım bu kadar gün eskiyince uyarı",
      keywords: ["ilan", "r10", "paylaşım", "yenileme"],
      control: <PostRefresh />,
    },
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
}
