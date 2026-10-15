import { AutoNumber, DAY_SUFFIX } from "@kit/components/settings/Fields";
import { REFRESH_MIN_DAYS } from "./constants";
import { m } from "./messages";
import { putSettings, useSettings, type SettingRow } from "@kit/lib/settings";

/** Days after which a post without an interval of its own is due for a refresh */
function PostRefresh() {
  const s = useSettings();
  if (!s.data) return null;
  return <AutoNumber server={s.data.post_refresh_days} save={(n) => putSettings({ post_refresh_days: n })} settle={s.reload} label={m.settings.name} min={REFRESH_MIN_DAYS} suffix={DAY_SUFFIX} />;
}

/** The post refresh row of the "Takip kuralları" category */
export const postRefreshRows = (): SettingRow[] => [{
  id: "post_refresh_days",
  name: m.settings.name,
  hint: m.settings.hint,
  keywords: m.settings.keywords.split(","),
  control: <PostRefresh />,
}];
