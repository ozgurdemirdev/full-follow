// Import boundaries for the module split (docs/plan-moduler.md section 2.1). Prints file:line per violation, exits 1.
//  - packages/core:      imports no host or app package, nothing under packages/modules
//  - packages/modules/*: imports only @fullfollow/core, its own package and its own files
//  - app:                only src/modules.generated.ts (and tests) import module packages
//  - server:             only src/modules.generated.ts imports module packages, and only their "/server" part
//  - mcp: never imports a module package by name or path
//  - web (packages/web): only src/modules.generated.ts imports a module, and only its web/index (the manifest)
//  - module web/ folders: import React and npm packages, @kit/* and their own files; never another module's web folder, @fullfollow/*, server or node code
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = join(root, "packages");
const modulesDir = join(packages, "modules");
const SOURCE = /\.(?:[cm]?[tj]sx?)$/;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".vite"]);

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (SOURCE.test(e.name)) yield p;
  }
}

/** Own module packages: name -> folder */
const moduleNames = new Map();
if (existsSync(modulesDir)) {
  for (const d of readdirSync(modulesDir, { withFileTypes: true })) {
    const pkg = join(modulesDir, d.name, "package.json");
    if (d.isDirectory() && existsSync(pkg)) moduleNames.set(JSON.parse(readFileSync(pkg, "utf8")).name, join(modulesDir, d.name));
  }
}
const isModuleName = (spec) => moduleNames.has(spec) || /^@fullfollow\/mod-/.test(spec);
const under = (file, dir) => !relative(dir, file).startsWith("..") && relative(dir, file) !== "";

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])([^"']+)\1/g;
function imports(file) {
  const out = [];
  readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
    const t = line.trimStart();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    for (const m of line.matchAll(IMPORT_RE)) out.push({ spec: m[2], line: i + 1 });
  });
  return out;
}

const violations = [];
const report = (file, line, msg) => violations.push(`${relative(root, file).split(sep).join("/")}:${line}  ${msg}`);

// core
for (const file of walk(join(packages, "core"))) {
  for (const { spec, line } of imports(file)) {
    if (/^@fullfollow\/(app|server|mcp|web)(\/|$)/.test(spec) || isModuleName(spec)) report(file, line, `core must not import "${spec}"`);
    else if (spec.startsWith(".") && under(resolve(dirname(file), spec), modulesDir)) report(file, line, `core must not import a module by path ("${spec}")`);
  }
}

// module packages
for (const [name, dir] of moduleNames) {
  for (const file of walk(dir)) {
    for (const { spec, line } of imports(file)) {
      if (spec.startsWith("@fullfollow/") && spec !== "@fullfollow/core" && !spec.startsWith("@fullfollow/core/") && spec !== name && !spec.startsWith(`${name}/`)) {
        report(file, line, `module ${name} may import only @fullfollow/core, not "${spec}"`);
      } else if (spec.startsWith(".") && !under(resolve(dirname(file), spec), dir) && resolve(dirname(file), spec) !== dir) {
        report(file, line, `module ${name} must not import outside its own folder ("${spec}")`);
      }
    }
  }
}

// app: the generated list is the one place that loads module definitions (tests may import them to test across modules)
const appPackage = join(packages, "app");
for (const file of walk(appPackage)) {
  if (file === join(appPackage, "src", "modules.generated.ts") || under(file, join(appPackage, "test"))) continue;
  for (const { spec, line } of imports(file)) {
    if (isModuleName(spec)) report(file, line, `app loads modules only in src/modules.generated.ts, not "${spec}"`);
    else if (spec.startsWith(".") && under(resolve(dirname(file), spec), modulesDir)) report(file, line, `app must not import a module by path ("${spec}")`);
  }
}

// server: the generated controller list may import the "/server" part of a module, nothing else may import a module
const serverPackage = join(packages, "server");
for (const file of walk(serverPackage)) {
  const generated = file === join(serverPackage, "src", "modules.generated.ts");
  for (const { spec, line } of imports(file)) {
    if (isModuleName(spec)) {
      if (!generated) report(file, line, `server loads modules only in src/modules.generated.ts, not "${spec}"`);
      else if (!spec.endsWith("/server")) report(file, line, `the server may import only the "/server" part of a module, not "${spec}"`);
    } else if (spec.startsWith(".") && under(resolve(dirname(file), spec), modulesDir)) report(file, line, `server must not import a module by path ("${spec}")`);
  }
}

// mcp: modules reach it only through @fullfollow/app
for (const file of walk(join(packages, "mcp"))) {
  for (const { spec, line } of imports(file)) {
    if (isModuleName(spec)) report(file, line, `import a module only through @fullfollow/app, not "${spec}"`);
    else if (spec.startsWith(".") && under(resolve(dirname(file), spec), modulesDir)) report(file, line, `import a module only through @fullfollow/app, not by path ("${spec}")`);
  }
}

// web host: the generated list is the one place that loads a module's web manifest (web/index), nothing else of a module
const webPackage = join(packages, "web");
const webGenerated = join(webPackage, "src", "modules.generated.ts");
for (const file of walk(webPackage)) {
  for (const { spec, line } of imports(file)) {
    if (isModuleName(spec)) report(file, line, `the web loads modules only through src/modules.generated.ts, not "${spec}"`);
    else if (spec.startsWith(".") && under(resolve(dirname(file), spec), modulesDir)) {
      const target = relative(modulesDir, resolve(dirname(file), spec)).split(sep).join("/");
      if (file !== webGenerated || !/^[^/]+\/web\/index$/.test(target)) report(file, line, `the web loads a module only as web/index in src/modules.generated.ts, not by path ("${spec}")`);
    }
  }
}

// module web folders: the kit (@kit/*), npm packages and their own files only
const NODE_BUILTIN = /^(?:node:|(?:fs|path|os|child_process|crypto|http|https|net|stream|url|util|zlib|events|buffer|worker_threads)(?:\/|$)|@nestjs\/|better-sqlite3$|drizzle-orm)/;
for (const [name, dir] of moduleNames) {
  const webDir = join(dir, "web");
  for (const file of walk(webDir)) {
    for (const { spec, line } of imports(file)) {
      if (spec.startsWith("@fullfollow/")) report(file, line, `web code of ${name} must not import "${spec}" (use @kit/*)`);
      else if (NODE_BUILTIN.test(spec)) report(file, line, `web code of ${name} must not import server or node code ("${spec}")`);
      else if (spec.startsWith(".") && !under(resolve(dirname(file), spec), webDir) && resolve(dirname(file), spec) !== webDir) {
        report(file, line, `web code of ${name} may import only @kit/* and its own web folder, not "${spec}" (another module's web part is never imported)`);
      }
    }
  }
}

if (violations.length) {
  console.error(violations.join("\n"));
  console.error(`\n${violations.length} boundary violation${violations.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`boundaries ok (${moduleNames.size} module package${moduleNames.size === 1 ? "" : "s"})`);
