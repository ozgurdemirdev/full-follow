// Paths of the pages that are not moved into their module yet (a moved module keeps its path in its own manifest).
// Routes, nav items and record links come from the module registry (app/modules/registry.ts); this file only names paths other screens link to.

export const PATHS = {
  today: "/",
  pipeline: "/huni",
  opportunity: "/firsatlar",
  people: "/kisiler",
  companies: "/firmalar",
  referrals: "/referanslar",
  projects: "/projeler",
  timeline: "/zaman",
  drafts: "/taslaklar",
  comments: "/yorumlar",
  posts: "/paylasimlar",
  ideas: "/fikirler",
  ownProjects: "/projelerim",
  settings: "/ayarlar",
};

export const settingsPath = (slug: string) => `${PATHS.settings}/${slug}`;
export const opportunityPath = (id: number) => `${PATHS.opportunity}/${id}`;
export const timelinePath = (type: string, id: number) => `/zaman/${type}/${id}`;
