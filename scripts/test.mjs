// npm test: regenerate the module lists, then run the tests of core, app, server, web and every installed module package.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { installedModules, root } from "./lib/modules.mjs";

const gen = spawnSync(process.execPath, [join(root, "scripts", "gen-modules.mjs")], { cwd: root, stdio: "inherit" });
if (gen.status !== 0) process.exit(gen.status ?? 1);

const packages = ["@fullfollow/core", "@fullfollow/app", "@fullfollow/server", "@fullfollow/web", ...installedModules().map((m) => m.name)];
let failed = 0;
for (const name of packages) {
  const r = spawnSync("npm", ["run", "test", "-w", name], { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) failed++;
}
if (failed) {
  console.error(`\n${failed} package${failed === 1 ? "" : "s"} with failing tests`);
  process.exit(1);
}
