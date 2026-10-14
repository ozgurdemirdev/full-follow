import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run against core's sources, so they do not depend on a prior build of core.
export default defineConfig({
  resolve: { alias: { "@fullfollow/core": path.resolve(__dirname, "../core/src/index.ts") } },
});
