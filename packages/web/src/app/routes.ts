// Paths of the pages that are not moved into their module yet (a moved module keeps its path in its own manifest).
// Routes, nav items and record links come from the module registry (app/modules/registry.ts); this file only names paths other screens link to.

export const PATHS = {
  today: "/",
  timeline: "/zaman",
  report: "/rapor",
  review: "/inceleme",
  drafts: "/taslaklar",
  comments: "/yorumlar",
  posts: "/paylasimlar",
  ideas: "/fikirler",
  templates: "/sablonlar",
  settings: "/ayarlar",
};

export const settingsPath = (slug: string) => `${PATHS.settings}/${slug}`;
export const timelinePath = (type: string, id: number) => `/zaman/${type}/${id}`;
