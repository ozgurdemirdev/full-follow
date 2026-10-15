// What the shell shows, built from the manifests of the installed, visible modules (and the kit's own `core` manifest).
// One place answers "which routes, nav items, cards, forms, links, search sources and slot components are there right now":
// the shell asks here and never names a module.
import { lazy, useEffect, useState, type ComponentType, type LazyExoticComponent } from "react";
import { endpointOwners, webModules } from "../../modules.generated";
import { moduleVisible, setEndpointOwners, useModules } from "../../api/modules";
import { m as kit } from "../../messages";
import { core } from "./core";
import { setLinkResolver, setPageResolver } from "./links";
import type { DashboardEntry, Lazy, NavEntry, QuickAddEntry, RouteEntry, SearchSource, SettingsCategoryDef, SettingsEntry, SlotEntry, WebModule } from "./types";

// handed over as a function: the generated list is read on first use, after the manifests (which import the kit) have all loaded
setEndpointOwners(() => endpointOwners);
setLinkResolver((type, id) => currentRegistry().link(type, id));
setPageResolver((page) => currentRegistry().pagePath(page));

/** Sidebar groups in display order (a group a module names that is not here follows them) */
export const NAV_GROUPS = Object.values(kit.navGroups);
/** Quick add groups in display order */
export const QUICK_GROUPS = Object.values(kit.quickGroups);
/** Slot entries without an order of their own sort here */
const DEFAULT_SLOT_ORDER = 100;

/** The kit and the installed web modules (read when first needed, not at import time: the manifests import parts of the kit, the kit imports this file) */
const manifests = (): WebModule[] => [core, ...webModules];
/** Installed web modules in the generated order (the Modüller switches list these) */
export const moduleLabels = () => webModules.map((m) => ({ key: m.key as string, label: m.label }));

export interface Registry {
  routes: RouteEntry[];
  nav: { label: string; items: NavEntry[] }[];
  /** by global `order`, one card per id */
  dashboard: DashboardEntry[];
  quickGroups: { name: string; items: QuickAddEntry[] }[];
  quickByKind: ReadonlyMap<string, QuickAddEntry>;
  search: SearchSource[];
  settings: SettingsEntry[];
  settingsCategories: SettingsCategoryDef[];
  /** components of a slot, in order */
  slot: (name: string) => { key: string; Component: ComponentType<any> }[];
  /** where a record of this type leads: null when no visible module serves it, or it has no page of its own */
  link: (type: string, id: number) => string | null;
  /** the path of a module's page (its route `page` id, without the `params`): null when no visible module has that page */
  pagePath: (page: string) => string | null;
  /** extra prefixes to refresh after a write to this resource */
  invalidates: (resource: string) => string[];
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

function build(visible: (key: string) => boolean): Registry {
  const active = manifests().filter((m) => m.key === "core" || visible(m.key));
  const all = <T>(pick: (m: WebModule) => T[] | undefined): T[] => active.flatMap((m) => pick(m) ?? []);

  const nav = all((m) => m.nav);
  const groupNames = [...NAV_GROUPS, ...new Set(nav.map((n) => n.group).filter((g) => !NAV_GROUPS.includes(g)))];
  const quick = all((m) => m.quickAdd);
  const quickNames = [...QUICK_GROUPS, ...new Set(quick.map((q) => q.group).filter((g) => !QUICK_GROUPS.includes(g)))];

  const dashboard = new Map<string, DashboardEntry>();
  for (const d of all((m) => m.dashboard).sort(byOrder)) if (!dashboard.has(d.id)) dashboard.set(d.id, d);

  const slots = new Map<string, { key: string; order: number; Component: ComponentType<any> }[]>();
  for (const m of active) {
    for (const [name, v] of Object.entries(m.slots ?? {})) {
      const entry: SlotEntry = typeof v === "object" && "Component" in v ? v : { Component: v };
      slots.set(name, [...(slots.get(name) ?? []), { key: `${m.key}:${name}`, order: entry.order ?? DEFAULT_SLOT_ORDER, Component: entry.Component }]);
    }
  }
  const links = Object.assign({}, ...active.map((m) => m.links ?? {})) as Record<string, (id: number) => string | null>;
  const invalidates: Record<string, string[]> = {};
  for (const m of active) for (const [resource, list] of Object.entries(m.invalidates ?? {})) invalidates[resource] = [...(invalidates[resource] ?? []), ...list];

  return {
    routes: all((m) => m.routes),
    nav: groupNames.map((label) => ({ label, items: nav.filter((n) => n.group === label).sort(byOrder) })).filter((g) => g.items.length),
    dashboard: [...dashboard.values()],
    quickGroups: quickNames.map((name) => ({ name, items: quick.filter((q) => q.group === name).sort(byOrder) })).filter((g) => g.items.length),
    quickByKind: new Map(quick.map((q) => [q.kind, q])),
    search: all((m) => m.search).sort(byOrder),
    settings: all((m) => m.settings),
    settingsCategories: all((m) => m.settingsCategories).sort(byOrder),
    slot: (name) => [...(slots.get(name) ?? [])].sort((a, b) => a.order - b.order),
    link: (type, id) => links[type]?.(id) ?? null,
    pagePath: (page) => all((m) => m.routes).find((r) => r.page === page)?.path ?? null,
    invalidates: (resource) => invalidates[resource] ?? [],
  };
}

let cached: { signature: string; registry: Registry } | null = null;

/** The registry for the modules `visible` accepts (rebuilt only when that set changes) */
function registryFor(visible: (key: string) => boolean): Registry {
  const signature = webModules.filter((m) => visible(m.key)).map((m) => m.key).join(",");
  if (!cached || cached.signature !== signature) cached = { signature, registry: build(visible) };
  return cached.registry;
}

/** The registry for the modules that are visible right now: for code that runs outside React or inside an event handler (a render uses useRegistry) */
export const currentRegistry = (): Registry => registryFor(moduleVisible);

/**
 * The registry as a hook: the component draws again when a module is hidden or shown. The `visible` function the call depends on
 * changes with that, which is what keeps the React compiler from caching the answer for good.
 */
export function useRegistry(): Registry {
  const { visible } = useModules();
  return registryFor(visible);
}

/** The same, as a hook (draws again when a module is hidden or shown) */
export const useLinkTo = () => useRegistry().link;

/** The extra prefixes a write to this resource refreshes (api/actions) */
export const invalidatesFor = (resource: string) => currentRegistry().invalidates(resource);

// ---- components loaded on demand ----

const lazies = new WeakMap<object, LazyExoticComponent<ComponentType<any>>>();
/** The lazy component of a manifest loader (one per loader, so a form or page is created once) */
export function lazyOf<P>(load: Lazy<P>): LazyExoticComponent<ComponentType<P>> {
  let c = lazies.get(load);
  if (!c) lazies.set(load, (c = lazy(load as Lazy<any>)));
  return c as LazyExoticComponent<ComponentType<P>>;
}

const loaded = new WeakMap<object, ComponentType<any>>();
const gone: ComponentType = () => null;

/**
 * Loads several components at once and answers with a lookup when all are there (null before): the dashboard draws its masonry once,
 * with every card's real height, instead of cards popping in one by one. A chunk that fails to load leaves its card out.
 */
export function useLoaded<P>(loads: Lazy<P>[]): ((load: Lazy<P>) => ComponentType<P>) | null {
  "use no memo"; // reads a module level cache while rendering: a compiler that cached the answer by its arguments would never see it fill
  const [, bump] = useState(0);
  const missing = loads.filter((l) => !loaded.has(l));
  useEffect(() => {
    if (!missing.length) return;
    let alive = true;
    void Promise.all(missing.map((l) => l().then((m) => void loaded.set(l, m.default), () => void loaded.set(l, gone)))).then(() => alive && bump((n) => n + 1));
    return () => void (alive = false);
  });
  return missing.length ? null : (l) => loaded.get(l) as ComponentType<P>;
}

/** Starts loading a page (menu hover, idle time) */
export function preloadRoute(match: { page?: string; path?: string }) {
  const r = currentRegistry().routes.find((x) => (match.page ? x.page === match.page : x.path === match.path));
  if (r) void r.load();
}
