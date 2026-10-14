// Backend build: regenerate the module lists, then tsc -b in dependency order:
// core, the installed module packages, app, server, mcp. Modules are discovered, never listed by hand;
// a module that is switched off (FF_MODULES_OFF) or whose folder is gone is simply not built.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { installedModules, root } from "./lib/modules.mjs";

const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run([join(root, "scripts", "gen-modules.mjs")]);
const tsc = createRequire(join(root, "package.json")).resolve("typescript/bin/tsc");
const projects = [
  "packages/core",
  ...installedModules().map((m) => relative(root, m.dir).split("\\").join("/")),
  "packages/app", "packages/server", "packages/mcp",
];
run([tsc, "-b", ...projects]);
