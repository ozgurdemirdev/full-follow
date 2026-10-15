// Fails when a text a person reads, or a tunable value, is written inline instead of living in one named place.
// Texts belong in a `messages` file made with defineMessages (packages/core/src/i18n.ts); values in a constants file.
//   node scripts/check-text.mjs                     every package
//   node scripts/check-text.mjs packages/modules/people packages/web   only these folders
// Flags: JSX text; string literals with Turkish letters; text-like props (label, title, placeholder, ...); the message of
// FFError / refuse; `limit: <number>`; a numeric delay passed to setTimeout / setInterval.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, sep } from "node:path";
import { root } from "./lib/modules.mjs";

const require = createRequire(join(root, "packages", "web", "package.json"));
const ts = require("typescript");

const SKIP_DIRS = new Set(["node_modules", "dist", "migrations", "test", "__tests__", "public"]);
const ALLOWED_FILE = /(^|[\\/])(messages(\.[a-z]+)?|i18n|constants|tokens)\.tsx?$|\.test\.tsx?$|\.generated\.|\.d\.ts$|vite\.config|vitest\.config|drizzle\.config/;
const TURKISH = /[çğıöşüÇĞİÖŞÜ₺]/;
const LETTER = /\p{L}/u;
const TEXT_PROPS = new Set(["label", "title", "placeholder", "hint", "noun", "dest", "ok", "empty", "message", "tooltip", "sub", "aria-label", "alt", "confirm", "caption"]);
/** call name to the index of its message argument */
const ERROR_CALLS = new Map([["FFError", 1], ["refuse", 0]]);
const TIMER_CALLS = new Set(["setTimeout", "setInterval"]);

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : ["packages"]).map((p) => join(root, p));

function* files(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* files(join(dir, e.name));
    } else if (/\.tsx?$/.test(e.name) && !ALLOWED_FILE.test(e.name)) yield join(dir, e.name);
  }
}

const hits = [];
function report(sf, node, what) {
  const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  hits.push(`${relative(root, sf.fileName).split(sep).join("/")}:${line + 1}: ${what}`);
}

const textOf = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((s) => s.literal.text).join("") : null);
const nameOf = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : n && ts.isJsxNamespacedName?.(n) ? `${n.namespace.text}:${n.name.text}` : null);
const callee = (e) => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null);
const short = (s) => JSON.stringify(s.length > 50 ? `${s.slice(0, 50)}…` : s);

function check(file) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node) && LETTER.test(node.text)) report(sf, node, `JSX text ${short(node.text.trim())}`);
    const text = textOf(node);
    if (text != null && !ts.isImportDeclaration(node.parent)) {
      const p = node.parent;
      const prop = ts.isPropertyAssignment(p) ? nameOf(p.name) : ts.isJsxAttribute(p) ? nameOf(p.name) : null;
      if (TURKISH.test(text)) report(sf, node, `text ${short(text)}`);
      else if (prop && TEXT_PROPS.has(prop) && LETTER.test(text)) report(sf, node, `${prop} ${short(text)}`);
      else if ((ts.isNewExpression(p) || ts.isCallExpression(p)) && ERROR_CALLS.has(callee(p.expression)) && p.arguments?.[ERROR_CALLS.get(callee(p.expression))] === node && LETTER.test(text)) report(sf, node, `error text ${short(text)}`);
    }
    if (ts.isPropertyAssignment(node) && nameOf(node.name) === "limit" && ts.isNumericLiteral(node.initializer)) report(sf, node, `limit ${node.initializer.text}`);
    if (ts.isCallExpression(node) && TIMER_CALLS.has(callee(node.expression)) && node.arguments[1] && ts.isNumericLiteral(node.arguments[1])) report(sf, node, `delay ${node.arguments[1].text}`);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

for (const t of targets) {
  if (statSync(t).isDirectory()) for (const f of files(t)) check(f);
  else check(t);
}

if (hits.length) {
  console.log(hits.join("\n"));
  console.log(`\ncheck:text: ${hits.length} inline texts or values (move them into a messages or constants file)`);
  process.exit(1);
}
console.log("check:text: ok");
