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
  drafts: () => import("../pages/Drafts"),
  comments: () => import("../pages/Comments"),
  posts: () => import("../pages/Posts"),
  ideas: () => import("../pages/Ideas"),
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
  drafts: "/taslaklar",
  comments: "/yorumlar",
  posts: "/paylasimlar",
  ideas: "/fikirler",
  templates: "/sablonlar",
  settings: "/ayarlar",
};

export const timelinePath = (type: "person" | "opportunity" | "project", id: number) => `/zaman/${type}/${id}`;
