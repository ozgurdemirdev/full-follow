import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests run against the sources of core and of every module package, so they do not depend on a prior build
// and every package shares one copy of core (an FFError thrown inside a module is the one the tests catch).
const modulesDir = path.resolve(__dirname, "../modules");
const moduleSources = existsSync(modulesDir)
  ? readdirSync(modulesDir, { withFileTypes: true }).flatMap((d) => {
      const pkg = path.join(modulesDir, d.name, "package.json");
      return d.isDirectory() && existsSync(pkg)
        ? [
            { find: new RegExp(`^${JSON.parse(readFileSync(pkg, "utf8")).name}/server$`), replacement: path.join(modulesDir, d.name, "src/server/index.ts") },
            { find: new RegExp(`^${JSON.parse(readFileSync(pkg, "utf8")).name}$`), replacement: path.join(modulesDir, d.name, "src/index.ts") },
          ]
        : [];
    })
  : [];

export default defineConfig({
  resolve: { alias: [{ find: "@fullfollow/core", replacement: path.resolve(__dirname, "../core/src/index.ts") }, ...moduleSources] },
});
