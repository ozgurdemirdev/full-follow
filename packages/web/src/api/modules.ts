// Which feature modules this server has (`GET /api/modules`), read once before the app draws, and the one place that answers
// "is this module here": the shell, the dashboard and the data layer all ask it. Core features (dashboard, comments, settings) belong to no module.
import { useMemo, useSyncExternalStore } from "react";
import { api } from "./client";

export type ModuleKey =
  | "calendar" | "chat" | "companies" | "drafts" | "ideas" | "network" | "own-projects" | "people" | "pipeline"
  | "posts" | "projects" | "referrals" | "reports" | "templates" | "timeline";

/**
 * The module behind each endpoint, longest prefix first (`/report/sources` is the pipeline's, `/report/referrals` the referrals',
 * the rest of `/report` the reports'). An endpoint that is not listed belongs to core.
 */
const ENDPOINT_MODULE: [string, ModuleKey][] = [
  ["/report/sources", "pipeline"],
  ["/report/referrals", "referrals"],
  ["/own-projects", "own-projects"],
  ["/opportunity-people", "pipeline"],
  ["/opportunities", "pipeline"],
  ["/offers", "pipeline"],
  ["/people", "people"],
  ["/companies", "companies"],
  ["/touches", "network"],
  ["/network", "network"],
  ["/stats", "network"],
  ["/tasks", "calendar"],
  ["/goals", "calendar"],
  ["/plan", "calendar"],
  ["/calendar", "calendar"],
  ["/projects", "projects"],
  ["/payments", "projects"],
  ["/drafts", "drafts"],
  ["/followups", "drafts"],
  ["/posts", "posts"],
  ["/ideas", "ideas"],
  ["/templates", "templates"],
  ["/timeline", "timeline"],
  ["/chat", "chat"],
  ["/report", "reports"],
  ["/review", "reports"],
];

/** Keys the server has; null until read, or when it cannot be (an older server): then every module counts as installed */
let installed: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

/** Reads `GET /api/modules`; never fails (a server without the endpoint keeps everything on) */
export async function loadModules() {
  try {
    installed = new Set((await api.get<{ key: string }[]>("/modules")).map((m) => m.key));
  } catch {
    installed = null;
  }
  listeners.forEach((fn) => fn());
}

const moduleOn = (key: ModuleKey | null | undefined) => !key || !installed || installed.has(key);

/** Whether the server has the endpoint behind a data key (`/people?limit=5`): a read for one that is gone is never sent */
export function endpointOn(path: string) {
  const [, tail = ""] = path.match(/^(\/[^?]*)/) ?? [];
  const hit = ENDPOINT_MODULE.find(([prefix]) => tail === prefix || tail.startsWith(`${prefix}/`));
  return moduleOn(hit?.[1]);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** `has(key)`: the module is installed (no key: always) */
export function useModules() {
  const keys = useSyncExternalStore(subscribe, () => installed);
  const has = useMemo(() => (key: ModuleKey | null | undefined) => !key || !keys || keys.has(key), [keys]);
  return { has };
}

/** A read the server answered with "no such endpoint": the module behind it is switched off */
export const isMissing = (error?: { status?: number }) => error?.status === 404;
