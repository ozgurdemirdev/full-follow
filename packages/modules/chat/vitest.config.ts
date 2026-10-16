import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run against core's sources, so they do not depend on a prior build of core.
// The web part is rendered with the automatic JSX runtime, as Vite builds it for the app.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@fullfollow/core": path.resolve(__dirname, "../../core/src/index.ts") } },
});
