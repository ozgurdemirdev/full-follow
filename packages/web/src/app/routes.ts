// Paths of the pages the kit owns (the dashboard, the comments, the settings). A module keeps its own path in its manifest;
// other screens reach a module's pages through the registry (`linkTo`, `pageTo`).

export const PATHS = {
  today: "/",
  comments: "/yorumlar",
  settings: "/ayarlar",
};

export const settingsPath = (slug: string) => `${PATHS.settings}/${slug}`;
