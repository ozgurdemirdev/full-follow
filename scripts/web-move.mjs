// Moves files of packages/web/src into a module's web part (packages/modules/<key>/web) with `git mv`, and rewrites the imports
// of the moved files so they still resolve: an import of another moved file stays relative, an import of anything left in the kit
// becomes `@kit/...`. It does not touch the files that import the moved ones; those are edited by hand (they should go through the registry).
//
//   node scripts/web-move.mjs <key> <from>:<to> [<from>:<to> ...]
//   node scripts/web-move.mjs calendar pages/Calendar.tsx:pages/Calendar.tsx lib/calendar.ts:calendar.ts styles/calendar.css:styles.css
//
// <from> is relative to packages/web/src, <to> relative to packages/modules/<key>/web. A <from> ending in "/" moves the whole folder.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webSrc = join(root, "packages", "web", "src");
const [key, ...pairs] = process.argv.slice(2);
if (!key || !pairs.length) {
  console.error("usage: node scripts/web-move.mjs <key> <from>:<to> [...]");
  process.exit(1);
}
const dest = join(root, "packages", "modules", key, "web");
if (!existsSync(join(root, "packages", "modules", key, "package.json"))) {
  console.error(`no module package packages/modules/${key}`);
  process.exit(1);
}

const posix = (p) => p.split(sep).join("/");
const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));

/** [oldAbsolute, newAbsolute] for every file */
const moves = [];
for (const pair of pairs) {
  const [from, to] = pair.split(":");
  const src = join(webSrc, from);
  if (!existsSync(src)) throw new Error(`${from} does not exist`);
  if (statSync(src).isDirectory()) for (const f of files(src)) moves.push([f, join(dest, to, relative(src, f))]);
  else moves.push([src, join(dest, to)]);
}
const moved = new Map(moves);
const stripExt = (p) => p.replace(/\.(?:[cm]?[tj]sx?)$/, "");
const byBase = new Map(moves.map(([from, to]) => [stripExt(from), to]));

// resolve a specifier written in the file's old place to the module it names (file, folder with index, or an asset)
function target(oldFile, spec) {
  const base = resolve(dirname(oldFile), spec);
  for (const c of [base, ...["ts", "tsx", "js", "jsx"].map((e) => `${base}.${e}`), ...["ts", "tsx"].map((e) => join(base, `index.${e}`))]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return base;
}

for (const [from, to] of moves) {
  mkdirSync(dirname(to), { recursive: true });
  const r = spawnSync("git", ["mv", from, to], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const IMPORT = /(\bfrom\s*|\bimport\s*\(?\s*|^\s*@import\s+)(["'])(\.{1,2}\/[^"']*)\2/gm;
let rewritten = 0;
for (const [oldFile, newFile] of moves) {
  if (!/\.(?:[cm]?[tj]sx?|css)$/.test(newFile)) continue;
  const text = readFileSync(newFile, "utf8");
  const next = text.replace(IMPORT, (all, lead, quote, spec) => {
    const hit = target(oldFile, spec);
    const movedTo = moved.get(hit) ?? byBase.get(stripExt(hit));
    let out;
    if (movedTo) {
      const rel = posix(relative(dirname(newFile), movedTo));
      out = (rel.startsWith(".") ? rel : `./${rel}`).replace(/\.(?:[cm]?[tj]sx?)$/, (m) => (spec.endsWith(m) ? m : ""));
    } else if (hit.startsWith(webSrc + sep)) {
      out = `@kit/${posix(relative(webSrc, hit))}`.replace(/\.(?:[cm]?[tj]sx?)$/, (m) => (spec.endsWith(m) ? m : ""));
    } else return all;
    return `${lead}${quote}${out}${quote}`;
  });
  if (next !== text) {
    writeFileSync(newFile, next);
    rewritten++;
  }
}
console.log(`moved ${moves.length} file(s) into packages/modules/${key}/web, rewrote the imports of ${rewritten}`);
