// Which feature modules this server has (`GET /api/modules`) and which of them Özgür hid (setting `modules_hidden`), both read once before the app draws.
// Two different questions: `has(key)` is "is the module installed" (a read for a module that is not there is never sent, data guards use it),
// `visible(key)` is "installed and not hidden" (everything that is only on screen: routes, nav, cards, forms, links, slots, search).
// Core features (dashboard, comments, settings) belong to no module.
import { useMemo, useSyncExternalStore } from "react";
import { api } from "./client";

export type ModuleKey =
  | "calendar" | "chat" | "companies" | "drafts" | "ideas" | "mascot" | "network" | "own-projects" | "people" | "pipeline"
  | "posts" | "projects" | "referrals" | "reports" | "templates" | "timeline";

/** API prefix to the module that owns it, longest prefix first. The registry hands over the generated list as a function (read on first use, so the import cycle with the manifests never matters) */
let ownerSource: () => readonly [string, string][] = () => [];
let owners: [string, string][] | null = null;
export const setEndpointOwners = (source: () => readonly [string, string][]) => {
  ownerSource = source;
  owners = null;
};

interface State {
  /** Keys the server has; null until read, or when it cannot be (an older server): then every module counts as installed */
  installed: ReadonlySet<string> | null;
  hidden: ReadonlySet<string>;
}
let state: State = { installed: null, hidden: new Set() };
const listeners = new Set<() => void>();
const publish = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

/** Reads `GET /api/modules` and the hidden list of `GET /api/settings`; never fails (a server without the endpoint keeps everything on) */
export async function loadModules() {
  const [keys, hidden] = await Promise.all([
    api.get<{ key: string }[]>("/modules").then((l) => new Set(l.map((m) => m.key)), () => null),
    api.get<{ modules_hidden?: string[] }>("/settings").then((s) => s.modules_hidden ?? [], () => [] as string[]),
  ]);
  publish({ installed: keys, hidden: new Set(hidden) });
}

/** The hidden list as the settings answer has it (the Modüller switches call this, optimistically, and again to roll back) */
export const setHiddenModules = (keys: readonly string[]) => publish({ hidden: new Set(keys) });

const installedIn = (s: State, key: string | null | undefined) => !key || !s.installed || s.installed.has(key);
const visibleIn = (s: State, key: string | null | undefined) => installedIn(s, key) && !(key && s.hidden.has(key));

/** The module key that owns an endpoint (`/people?limit=5`, `/tasks/12`), undefined for a core endpoint */
function ownerOf(path: string): string | undefined {
  const [, tail = ""] = path.match(/^(\/[^?]*)/) ?? [];
  owners ??= [...ownerSource()].sort((a, b) => b[0].length - a[0].length);
  return owners.find(([prefix]) => tail === prefix || tail.startsWith(`${prefix}/`))?.[1];
}

/** Whether the server has the endpoint behind a data key (`/people?limit=5`): a read or a write for one that is gone is never sent */
export const endpointOn = (path: string) => installedIn(state, ownerOf(path));

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** The module is installed and not hidden (no key: always): the same test as `useModules().visible`, for code that runs outside React */
export const moduleVisible = (key: string | null | undefined) => visibleIn(state, key);

/** `has(key)`: installed (no key: always). `visible(key)`: installed and not hidden. Both change identity when either list changes */
export function useModules() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return useMemo(() => ({
    has: (key: string | null | undefined) => installedIn(snapshot, key),
    visible: (key: string | null | undefined) => visibleIn(snapshot, key),
    hidden: snapshot.hidden,
  }), [snapshot]);
}

/** The module behind an endpoint is installed and not hidden: a button that writes there is only drawn then (the endpoint itself stays open while hidden) */
export function useEndpointVisible(path: string): boolean {
  return visibleIn(useSyncExternalStore(subscribe, () => state), ownerOf(path));
}

/** A read the server answered with "no such endpoint": the module behind it is switched off */
export const isMissing = (error?: { status?: number }) => error?.status === 404;
