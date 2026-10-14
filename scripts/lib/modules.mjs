// Finds the module packages in packages/modules/* and the switched off keys (FF_MODULES_OFF=a,b).
// A module package declares itself with  "fullfollow": { "module": "<key>" }  in its package.json.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const modulesDir = join(root, "packages", "modules");

export const offKeys = () => [...new Set((process.env.FF_MODULES_OFF ?? "").split(",").map((s) => s.trim()).filter(Boolean))].sort();

/** Every module package, sorted by key: { key, name, dir, server }; `server` is true when it exports "./server" (NestJS controllers) */
export function discoverModules() {
  const found = [];
  if (existsSync(modulesDir)) {
    for (const dir of readdirSync(modulesDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const pkgPath = join(modulesDir, dir.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const key = pkg.fullfollow?.module;
      if (!key) continue;
      if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`${pkgPath}: module key "${key}" must be lower-case letters, digits and dashes`);
      if (found.some((m) => m.key === key)) throw new Error(`${pkgPath}: duplicate module key "${key}"`);
      found.push({ key, name: pkg.name, dir: join(modulesDir, dir.name), server: !!pkg.exports?.["./server"] });
    }
  }
  return found.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The modules that are not switched off */
export const installedModules = () => {
  const off = new Set(offKeys());
  return discoverModules().filter((m) => !off.has(m.key));
};
