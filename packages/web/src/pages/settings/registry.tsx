import { useMemo } from "react";
import { restore } from "../../api/actions";
import { useTrash } from "../../api/keys";
import { useModules } from "../../api/modules";
import { useQuery } from "../../api/store";
import { useRegistry } from "../../app/modules/registry";
import type { SettingsCategoryDef, SettingsCtx, SettingsEntry } from "../../app/modules/types";
import { BOARD_ICON } from "../../components/boardIcons";
import { ago } from "../../lib/format";
import { useSettings, type SettingCategory, type SettingRow } from "../../lib/settings";
import { accountRows } from "./AccountRows";
import { claudeRows } from "./ClaudeRows";
import { listRows } from "./ListRows";
import { moduleRows } from "./ModuleRows";

// Nav icons: the board's own paths (the ones the shell has are reused, the rest are the board's)
const ICON = {
  account: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c1-4 4.5-6 8-6s7 2 8 6",
  business: "M3 7h18v10H3zM3 10h18M7 14h3",
  follow: BOARD_ICON.clock,
  claude: BOARD_ICON.claude,
  lists: "M4 4h7l9 9-7 7-9-9zM8 8h.01",
  modules: BOARD_ICON.grid,
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
};

/** The categories the kit owns; modules add their own (the mascot's) and rows to any of them. Orders: modules slot in between by number */
const CORE_CATEGORIES: SettingsCategoryDef[] = [
  { slug: "hesap", name: "Hesap ve görünüm", icon: ICON.account, order: 10 },
  { slug: "isletme", name: "İşletme ve vergi", icon: ICON.business, sub: "Rapor’daki aylık taban buradan hesaplanır", order: 20 },
  { slug: "takip", name: "Takip kuralları", icon: ICON.follow, sub: "Claude bu sürelere göre “Bugün dokun” listesini kurar", order: 30 },
  { slug: "claude", name: "Claude", icon: ICON.claude, sub: "Claude MCP üzerinden aynı veritabanını kullanır", order: 40 },
  { slug: "liste", name: "Etiketler ve listeler", icon: ICON.lists, order: 60 },
  { slug: "moduller", name: "Modüller", icon: ICON.modules, sub: "Gizlediğin modül menüden, kartlardan ve hızlı eklemeden kalkar; verisi ve Claude erişimi yerinde durur", order: 70 },
  { slug: "cop", name: "Çöp kutusu", icon: ICON.trash, sub: "Sildiğin her şey burada durur. Geri yükleyince temasları, notları ve yorumlarıyla aynen döner", order: 80 },
];

/** The kit's rows (each category's rows are sorted by `order`: 10, 20, ... so a module's rows can sit between) */
const CORE_ENTRIES: SettingsEntry[] = [
  { id: "account", category: "hesap", order: 10, rows: ({ withSession }) => accountRows(withSession) },
  { id: "claude", category: "claude", order: 10, rows: () => claudeRows() },
  { id: "lists", category: "liste", order: 10, rows: () => listRows() },
];

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/** The single source of categories and rows: the nav, the search and the cards all read this */
export function useSettingCategories(): SettingCategory[] {
  const settings = useSettings();
  const me = useQuery<{ auth: boolean }>("/me");
  const trash = useTrash();
  const { has } = useModules();
  const { settingsCategories, settings: entries } = useRegistry();
  const floor = settings.data?.floor;
  const hasRules = Array.isArray(settings.data?.draft_rules);
  const withSession = !!me.data?.auth;

  return useMemo(() => {
    const ctx: SettingsCtx = { floor, hasRules, withSession };
    const trashRows: SettingRow[] = trash.rows.map((x) => ({
      id: `${x.type}-${x.id}`,
      name: `${x.label} · ${x.what}`,
      hint: `${ago(x.deleted_at)} silindi`,
      keywords: ["çöp", "silinen", "geri al"],
      control: <button type="button" className="set-btn" onClick={() => void restore(x.type, x.id).catch(() => {})}>Geri yükle</button>,
    }));
    const rowsOf = (slug: string): SettingRow[] => {
      if (slug === "moduller") return moduleRows(has);
      if (slug === "cop") return trashRows;
      return [...CORE_ENTRIES, ...entries].filter((e) => e.category === slug).sort(byOrder).flatMap((e) => e.rows(ctx));
    };
    const core = new Set(CORE_CATEGORIES.map((c) => c.slug));
    return [...CORE_CATEGORIES, ...settingsCategories]
      .sort(byOrder)
      .map((c): SettingCategory => ({
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        sub: c.sub,
        empty: c.slug === "cop" ? (trash.error && !trash.data ? "Çöp kutusu yüklenemedi." : trash.data ? "Çöp kutusu boş." : undefined) : undefined,
        rows: rowsOf(c.slug),
      }))
      // a category a module brought goes with it: no rows, no category
      .filter((c) => core.has(c.slug) || c.rows.length);
  }, [floor, hasRules, withSession, trash.rows, trash.data, trash.error, entries, settingsCategories, has]);
}
