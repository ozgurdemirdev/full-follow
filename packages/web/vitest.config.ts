import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The pure parts of the kit (parsers, counters, bounded caches); screens are checked by hand in the browser.
export default defineConfig({
  resolve: { alias: { "@kit": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["test/**/*.test.ts"] },
});
