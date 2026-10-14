import { useMemo } from "react";
import { restore } from "../../api/actions";
import { useTrash } from "../../api/keys";
import { useQuery } from "../../api/store";
import { BOARD_ICON } from "../../components/boardIcons";
import { ago } from "../../lib/format";
import { useSettings, type SettingCategory } from "../../lib/settings";
import { accountRows } from "./AccountRows";
import { businessRows } from "./BusinessRows";
import { claudeRows } from "./ClaudeRows";
import { followRows } from "./FollowRows";
import { listRows } from "./ListRows";
import { mascotRows } from "./MascotRows";

// Nav icons: the board's own paths (the ones the shell has are reused, the rest are the board's)
const ICON = {
  account: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1-4 4.5-6 8-6s7 2 8 6",
  business: "M3 7h18v10H3zM3 10h18M7 14h3",
  follow: BOARD_ICON.clock,
  claude: BOARD_ICON.claude,
  mascot: "M12 4c4 0 7 3 7 7v5l-2-1-2 2-3-2-3 2-2-2-2 1v-5c0-4 3-7 7-7zM9.5 10h.01M14.5 10h.01",
  lists: "M4 4h7l9 9-7 7-9-9zM8 8h.01",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
};

/** The single source of categories and rows: the nav, the search and the cards all read this */
export function useSettingCategories(): SettingCategory[] {
  const settings = useSettings();
  const me = useQuery<{ auth: boolean }>("/me");
  const trash = useTrash();
  const floor = settings.data?.floor;
  const hasRules = Array.isArray(settings.data?.draft_rules);
  const hasPostRefresh = typeof settings.data?.post_refresh_days === "number";
  const withSession = !!me.data?.auth;

  return useMemo(
    () => [
      { slug: "hesap", name: "Hesap ve görünüm", icon: ICON.account, rows: accountRows(withSession) },
      {
        slug: "isletme",
        name: "İşletme ve vergi",
        icon: ICON.business,
        sub: "Rapor’daki aylık taban buradan hesaplanır",
        rows: businessRows(floor),
      },
      {
        slug: "takip",
        name: "Takip kuralları",
        icon: ICON.follow,
        sub: "Claude bu sürelere göre “Bugün dokun” listesini kurar",
        rows: followRows(hasPostRefresh),
      },
      { slug: "claude", name: "Claude", icon: ICON.claude, sub: "Claude MCP üzerinden aynı veritabanını kullanır", rows: claudeRows(hasRules) },
      { slug: "maskot", name: "Maskot", icon: ICON.mascot, rows: mascotRows() },
      { slug: "liste", name: "Etiketler ve listeler", icon: ICON.lists, rows: listRows() },
      {
        slug: "cop",
        name: "Çöp kutusu",
        icon: ICON.trash,
        sub: "Sildiğin her şey burada durur. Geri yükleyince temasları, notları ve yorumlarıyla aynen döner",
        empty: trash.error && !trash.data ? "Çöp kutusu yüklenemedi." : trash.data ? "Çöp kutusu boş." : undefined,
        rows: trash.rows.map((x) => ({
          id: `${x.type}-${x.id}`,
          name: `${x.label} · ${x.what}`,
          hint: `${ago(x.deleted_at)} silindi`,
          keywords: ["çöp", "silinen", "geri al"],
          control: <button type="button" className="set-btn" onClick={() => void restore(x.type, x.id).catch(() => {})}>Geri yükle</button>,
        })),
      },
    ],
    [floor, hasRules, hasPostRefresh, withSession, trash.rows, trash.data, trash.error],
  );
}
