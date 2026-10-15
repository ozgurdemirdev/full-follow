// The manifest a module's web part exports (packages/modules/<key>/web/index.ts): everything the shell needs to show the module.
// Every field except `key` and `label` is optional; a module that has no dashboard card simply leaves `dashboard` out.
import type { ComponentType } from "react";
import type { ModuleKey } from "../../api/modules";
import type { Today } from "../../api/types";
import type { BoardIconName } from "../../components/boardIcons";
import type { FormProps } from "../../forms/shared";
import type { SettingRow } from "../../lib/settings";
import type { SheetState } from "../ui";

/** A component loaded on first use: `() => import("./pages/Calendar")` (default export) or `.then((m) => ({ default: m.Name }))` */
export type Lazy<P = object> = () => Promise<{ default: ComponentType<P> }>;

/** A page: lazy loaded, preloaded when its menu item is hovered. The route matches `path` plus `params` ("/:id?") */
export interface RouteEntry {
  /** stable id (the idle preload and the registry use it) */
  page: string;
  path: string;
  params?: string;
  load: Lazy;
}

/** A sidebar item. Groups show in the order of `NAV_GROUPS`, items by `order` inside their group */
export interface NavEntry {
  group: string;
  order: number;
  label: string;
  icon: BoardIconName;
  path: string;
  /** a hook: the count after the label (nothing when it returns 0, null or undefined) */
  useBadge?: () => number | null | undefined;
}

/**
 * A dashboard card. `order` is global across modules (it is the order on a phone and the order inside a column);
 * `column` pins it to one of the three columns (left out: it fills the shortest column). `show` hides it for a Today payload without its data.
 */
export interface DashboardEntry {
  id: string;
  column?: 0 | 1 | 2;
  order: number;
  show?: (today: Today) => boolean;
  load: Lazy<{ today: Today }>;
}

/** What a settings rows function can read: the settings payload and whether a login session exists */
export interface SettingsCtx {
  floor?: number;
  hasRules: boolean;
  withSession: boolean;
}

/** Rows of a settings category; rows of all entries of a category are sorted by `order` (a core entry owns the numbers 10, 20, ...) */
export interface SettingsEntry {
  id: string;
  category: string;
  order: number;
  rows: (ctx: SettingsCtx) => SettingRow[];
}

/** A settings category a module brings (a category with no rows is not shown) */
export interface SettingsCategoryDef {
  slug: string;
  name: string;
  /** svg path data of the nav icon */
  icon: string;
  sub?: string;
  order: number;
}

export type QuickTone = "accent" | "info" | "source" | "claude" | "payment" | "comment" | "neutral";
type Preset = NonNullable<SheetState["preset"]>;

/** What a form sheet says about its record type: names, where the record lands, header icon, how an edit is addressed */
export interface FormMeta {
  /** the type's name in titles and toasts ("Kişi" gives "Kişi ekle" and "Kişi eklendi") */
  noun: string;
  /** one line under the title: where the new record lands */
  dest: string;
  /** path of the header icon */
  icon: string;
  /** the form reads the record it edits itself (the sheet then does not, for the "Son değişiklik" line) */
  ownRead?: boolean;
  /** api path of the records (also where an edit is read and a delete goes) */
  base: string;
  /** id of the record being edited, read from the opener's preset */
  editId?: (pre: Preset) => number | undefined;
  /** the preset that opens the form on that record (for a type with no page of its own: the chat card opens its form) */
  editPreset?: (id: number) => Preset;
  /** page of a saved record, for the toast's "Aç" pill */
  page: (id: number | undefined, pre?: Preset) => string;
}

/** A record type the quick add menu offers and the form sheet can open (the sheet looks the form up by `kind`) */
export interface QuickAddEntry {
  kind: string;
  name: string;
  /** single letter that opens it while the menu is open */
  key: string;
  /** destination line of the menu row */
  dest: string;
  icon: string;
  tone: QuickTone;
  /** menu group; groups show in the order of `QUICK_GROUPS` */
  group: string;
  order: number;
  form: FormMeta;
  load: Lazy<FormProps>;
}

/** Where a search hit leads and what it says */
export interface SearchHit {
  key: string;
  label: string;
  sub: string;
  href: string;
}
export interface SearchCtx {
  recordHref: (type: string, id: number) => string;
}
/** A list the global search asks the server about (`GET path?q=...`: the server does the matching) and how a row of it reads as a hit */
export interface SearchSource {
  id: string;
  order: number;
  /** the list endpoint, which takes `q` and `limit` */
  path: string;
  hit: (row: any, ctx: SearchCtx) => SearchHit;
}

/** A component another module's screen renders by slot name (`<Slot name="person.overlay.side" props={...} />`) */
export interface SlotEntry<P = any> {
  /** the order among the modules that fill the slot (default 100) */
  order?: number;
  /** may be a `lazy()` component: the host wraps every entry in Suspense */
  Component: ComponentType<P>;
}

export interface WebModule {
  /** the module's key (the same as the server's); `core` is the kit's own contributions */
  key: ModuleKey | "core";
  /** Turkish name (the Modüller switches of Settings) */
  label: string;
  routes?: RouteEntry[];
  nav?: NavEntry[];
  dashboard?: DashboardEntry[];
  settings?: SettingsEntry[];
  settingsCategories?: SettingsCategoryDef[];
  quickAdd?: QuickAddEntry[];
  /** `linkTo(type, id)`: where a record of this type leads (null: no page of its own) */
  links?: Record<string, (id: number) => string | null>;
  search?: SearchSource[];
  /** named extension points of other screens; the value is a component or an entry with an order */
  slots?: Record<string, ComponentType<any> | SlotEntry>;
  /** after a write to a resource (the first path segment, `tasks`), these data prefixes are refreshed too */
  invalidates?: Record<string, string[]>;
}
