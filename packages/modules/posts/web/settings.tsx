import { AutoNumber, DAY_SUFFIX } from "@kit/components/settings/Fields";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";

/** Days after which a post without an interval of its own is due for a refresh */
function PostRefresh() {
  const s = useSettings();
  if (!s.data) return null;
  return <AutoNumber server={s.data.post_refresh_days} save={(n) => putSettings({ post_refresh_days: n })} settle={s.reload} label="Paylaşım güncelleme" min={1} suffix={DAY_SUFFIX} />;
}

/** The post refresh row of the "Takip kuralları" category */
export const postRefreshRows = (): SettingRow[] => [{
  id: "post_refresh_days",
  name: "Paylaşım güncelleme",
  hint: "Kendi aralığı olmayan paylaşım bu kadar gün eskiyince uyarı",
  keywords: ["ilan", "r10", "paylaşım", "yenileme"],
  control: <PostRefresh />,
}];
