// Sayfalar ayrı parçalar halinde yüklenir; menü öğesinin üzerine gelince önceden indirilir
import { lazy, type ComponentType } from "react";

const loaders = {
  today: () => import("../pages/Today"),
  calendar: () => import("../pages/Calendar"),
  pipeline: () => import("../pages/Pipeline"),
  people: () => import("../pages/People"),
  companies: () => import("../pages/Companies"),
  referrals: () => import("../pages/Referrals"),
  projects: () => import("../pages/Projects"),
  timeline: () => import("../pages/Timeline"),
  report: () => import("../pages/Report"),
  review: () => import("../pages/Review"),
  drafts: () => import("../pages/Drafts"),
  comments: () => import("../pages/Comments"),
  posts: () => import("../pages/Posts"),
  ideas: () => import("../pages/Ideas"),
  ownProjects: () => import("../pages/OwnProjects"),
  templates: () => import("../pages/Templates"),
  settings: () => import("../pages/Settings"),
};
export type PageKey = keyof typeof loaders;

export const pages = Object.fromEntries(Object.entries(loaders).map(([k, l]) => [k, lazy(l)])) as unknown as {
  [K in PageKey]: ComponentType;
};

const done = new Set<PageKey>();
export function preload(k: PageKey) {
  if (done.has(k)) return;
  done.add(k);
  void loaders[k]();
}

export const PATHS: Record<PageKey, string> = {
  today: "/",
  calendar: "/takvim",
  pipeline: "/huni",
  people: "/kisiler",
  companies: "/firmalar",
  referrals: "/referanslar",
  projects: "/projeler",
  timeline: "/zaman",
  report: "/rapor",
  review: "/inceleme",
  drafts: "/taslaklar",
  comments: "/yorumlar",
  posts: "/paylasimlar",
  ideas: "/fikirler",
  ownProjects: "/projelerim",
  templates: "/sablonlar",
  settings: "/ayarlar",
};

export const settingsPath = (slug: string) => `${PATHS.settings}/${slug}`;
export const timelinePath = (type: "person" | "opportunity" | "project", id: number) => `/zaman/${type}/${id}`;

/** Page of a record (people, companies, ideas, own projects, posts and timeline already take /:id; the rest follow the same pattern).
 *  null: no page of its own (task and goal open their form on the dashboard, payment lives inside its project). */
export function recordPath(type: string, id: number): string | null {
  switch (type) {
    case "person": return `${PATHS.people}/${id}`;
    case "company": return `${PATHS.companies}/${id}`;
    case "opportunity": return `${PATHS.pipeline}/${id}`;
    case "project": return `${PATHS.projects}/${id}`;
    case "draft": return `${PATHS.drafts}/${id}`;
    case "template": return `${PATHS.templates}/${id}`;
    case "idea": return `${PATHS.ideas}/${id}`;
    case "own_project": return `${PATHS.ownProjects}/${id}`;
    case "post": return `${PATHS.posts}/${id}`;
    case "comment": return `${PATHS.comments}/${id}`;
    default: return null;
  }
}
