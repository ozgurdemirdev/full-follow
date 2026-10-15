// npm run check:modules: the removal check (docs/plan-moduler.md section 3).
// For every installed module, and for "all off", it switches the module off (FF_MODULES_OFF), regenerates the module lists and then:
//   1. typechecks and builds the backend (tsc -b of core, the installed modules, app, server and MCP: the proof that removal compiles),
//   2. runs the tests of every remaining package (any non zero exit fails the case),
//   3. starts the server on a free port (3021..3029) against a seeded copy of the demo database, requests the core endpoints and
//      the `smoke` paths of every installed module (a 5xx, a 404 or no answer fails), checks /api/modules lists exactly the installed keys,
//      fetches the web page and its main bundle; the web is built for every case too (vite build only: the generated web list changes per case),
//      and the build must contain the `fullfollow.webMarkers` strings (a route path, a storage key) of exactly the installed modules that declare any,
//   4. starts the MCP host over stdio: initialize, tools/list (the tools of switched off modules are gone), today, find for every installed type.
// One line per case: `pass <case>` or `FAIL <case>: <first error>`; exit 1 when any case failed. The cases are the module keys,
// `all-off` and finally `all-on` (the baseline, so the build left behind is the normal one). Logs: $FF_CHECK_LOGS/<case>/ (default: the OS temp folder).
// `--only=<case>,<case>` runs just those. The generated module lists are always put back to all on at the end, also after a failure. Run it through the build lock when others build too:
// it builds many times, so take the lock once around the whole run.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, openSync, closeSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { discoverModules, root } from "./lib/modules.mjs";

const logRoot = process.env.FF_CHECK_LOGS || join(tmpdir(), "ff-check-modules");
const PORTS = [3021, 3022, 3023, 3024, 3025, 3026, 3027, 3028, 3029];
const STEP_TIMEOUT = 15 * 60 * 1000;
const CORE_PATHS = ["/api/health", "/api/today", "/api/meta", "/api/modules", "/api/settings", "/api/comments", "/api/trash"];
// the generic tools every MCP host has; the module tools come from the installed modules
const CORE_TOOLS = ["today", "find", "get", "save", "delete", "open"];

const node = process.execPath;
const script = (name) => join(root, "scripts", name);
const requireFrom = (pkg) => createRequire(join(root, "packages", pkg, "package.json"));
const webDir = join(root, "packages", "web");
// the vite the web package uses (a nested install when the root has another one): the bin is not an exported path, so go through package.json
const viteBin = join(dirname(requireFrom("web").resolve("vite/package.json")), "bin", "vite.js");
const baseEnv = () => {
  const env = { ...process.env, FF_OPEN: "0", FF_BACKUP: "0" };
  delete env.FF_MODULES_OFF;
  return env;
};

class CheckError extends Error {}

/** Runs a command with its output in the case log; throws CheckError(first error line) on a non zero exit */
function step(caseDir, name, cmd, args, env, cwd = root) {
  const file = join(caseDir, `${name}.log`);
  const fd = openSync(file, "w");
  const r = spawnSync(cmd, args, { cwd, env, stdio: ["ignore", fd, fd], timeout: STEP_TIMEOUT, shell: cmd !== node });
  closeSync(fd);
  if (r.status === 0) return;
  throw new CheckError(`${name}: ${firstError(file) ?? `exit ${r.status ?? r.signal}`} (${file})`);
}

const ERROR_LINE = /error TS\d+|\bFAIL\b|AssertionError|\bError:|✗|Cannot find|ERR!/;
function firstError(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return (lines.find((l) => ERROR_LINE.test(l)) ?? lines.at(-1))?.slice(0, 240);
}

/** npm without a shell when npm_execpath is known (npm run check:modules), else through the shell */
function npm(caseDir, name, args, env) {
  const cli = process.env.npm_execpath;
  if (cli && /\.c?js$/.test(cli)) step(caseDir, name, node, [cli, ...args], env);
  else step(caseDir, name, "npm", args, env);
}

const freePort = (port) => new Promise((done) => {
  const s = createServer();
  s.once("error", () => done(false));
  s.listen(port, "127.0.0.1", () => s.close(() => done(true)));
});

async function pickPort() {
  for (const p of PORTS) if (await freePort(p)) return p;
  throw new CheckError(`no free port in ${PORTS[0]}..${PORTS.at(-1)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The installed modules as the built app sees them: key, smoke paths, tool names, record types (read from dist in a child process) */
function dumpModules(env) {
  const code = "const m=require('./packages/app/dist/index.js').installedModules;console.log(JSON.stringify(m.map(d=>({key:d.key,smoke:d.smoke??[],tools:(d.mcp?.tools??[]).map(t=>t.name),types:Object.keys(d.entities??{})}))))";
  const r = spawnSync(node, ["-e", code], { cwd: root, env, encoding: "utf8" });
  if (r.status !== 0) throw new CheckError(`reading the built module list: ${(r.stderr || "").split(/\r?\n/).find(Boolean) ?? r.status}`);
  return JSON.parse(r.stdout);
}

async function get(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, text: String(e?.cause?.code ?? e) };
  }
}

/** Server: start, wait for /api/health, request every path, check /api/modules and the web page and its bundle, stop */
async function checkServer(caseDir, env, installed) {
  const port = await pickPort();
  const base = `http://127.0.0.1:${port}`;
  const fd = openSync(join(caseDir, "server.log"), "w");
  const child = spawn(node, [join(root, "packages", "server", "dist", "main.js")], { cwd: root, env: { ...env, FF_PORT: String(port) }, stdio: ["ignore", fd, fd] });
  let exited = null;
  child.on("exit", (code, sig) => (exited = code ?? sig));
  try {
    for (let i = 0; i < 120 && exited === null; i++) {
      if ((await get(`${base}/api/health`)).status === 200) break;
      await sleep(500);
    }
    if (exited !== null) throw new CheckError(`server exited (${exited}): ${firstError(join(caseDir, "server.log")) ?? ""}`);
    if ((await get(`${base}/api/health`)).status !== 200) throw new CheckError("server: /api/health did not answer in 60 s");
    const paths = [...CORE_PATHS, ...installed.flatMap((m) => m.smoke)];
    for (const p of paths) {
      const r = await get(base + p);
      if (r.status !== 200) throw new CheckError(`GET ${p} answered ${r.status || "no answer"}: ${r.text.slice(0, 160)}`);
      if (p === "/api/modules") {
        const keys = JSON.parse(r.text).map((m) => m.key).sort().join(",");
        const want = installed.map((m) => m.key).sort().join(",");
        if (keys !== want) throw new CheckError(`/api/modules lists [${keys}], expected [${want}]`);
      }
    }
    const page = await get(`${base}/`);
    if (page.status !== 200) throw new CheckError(`GET / answered ${page.status || "no answer"}`);
    const bundle = /<script[^>]+src="([^"]+\.js)"/.exec(page.text)?.[1];
    if (!bundle) throw new CheckError("the web page has no script bundle (is the web built?)");
    const js = await get(new URL(bundle, `${base}/`).href);
    if (js.status !== 200 || !js.text) throw new CheckError(`GET ${bundle} answered ${js.status || "no answer"}`);
  } finally {
    child.kill();
    closeSync(fd);
    for (let i = 0; i < 20 && exited === null; i++) await sleep(100);
  }
}

/** MCP host over stdio: initialize, tools/list, today, find of every installed record type (and a core one) */
async function checkMcp(caseDir, env, installed, allTools) {
  const sdk = requireFrom("mcp");
  const { Client } = sdk("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = sdk("@modelcontextprotocol/sdk/client/stdio.js");
  const transport = new StdioClientTransport({ command: node, args: [join(root, "packages", "mcp", "dist", "index.js")], cwd: root, env, stderr: "pipe" });
  const errors = [];
  transport.stderr?.on("data", (d) => errors.push(String(d)));
  const client = new Client({ name: "check-modules", version: "0.0.0" });
  try {
    await client.connect(transport);
    const names = (await client.listTools()).tools.map((t) => t.name);
    const installedTools = installed.flatMap((m) => m.tools);
    for (const t of [...CORE_TOOLS, ...installedTools]) if (!names.includes(t)) throw new CheckError(`mcp: tool ${t} is missing`);
    for (const t of allTools) if (!installedTools.includes(t) && names.includes(t)) throw new CheckError(`mcp: tool ${t} is listed although its module is off`);
    const call = async (name, args) => {
      const r = await client.callTool({ name, arguments: args });
      const text = (r.content ?? []).map((c) => c.text ?? "").join("");
      if (r.isError) throw new CheckError(`mcp: ${name} ${JSON.stringify(args)}: ${text.slice(0, 160)}`);
      return text;
    };
    await call("today", {});
    for (const type of ["source", ...installed.flatMap((m) => m.types)]) await call("find", { type, limit: 3 });
  } finally {
    await client.close().catch(() => {});
  }
}

/** All the JavaScript of the web build (the entry bundle and the lazy chunks) */
function bundleText() {
  const dir = join(webDir, "dist", "assets");
  return readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}

/**
 * The web build holds the `fullfollow.webMarkers` of a module (a route path, a storage key: strings only that module's web part has) exactly when
 * the module is installed: an off module's pages, cards and forms must not be in the build, and an installed one's must (so the check cannot go blind).
 */
function checkBundle(modules, installed) {
  const text = bundleText();
  const on = new Set(installed.map((m) => m.key));
  for (const m of modules) {
    for (const marker of m.webMarkers) {
      const found = text.includes(marker);
      if (found && !on.has(m.key)) throw new CheckError(`web: "${marker}" of the switched off module ${m.key} is in the build`);
      if (!found && on.has(m.key)) throw new CheckError(`web: "${marker}" of the installed module ${m.key} is not in the build (fix fullfollow.webMarkers in its package.json)`);
    }
  }
}

/** One case: the given module keys are off */
async function runCase(name, off, ctx) {
  const dir = join(logRoot, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const db = join(dir, "check.db");
  copyFileSync(ctx.seedDb, db);
  const env = { ...baseEnv(), FF_DB: db, ...(off.length ? { FF_MODULES_OFF: off.join(",") } : {}) };
  ctx.distIsAllOn = false;
  step(dir, "build", node, [script("build.mjs")], env);
  ctx.distIsAllOn = !off.length;
  // the web build of this case: the generated web list follows FF_MODULES_OFF (vite only: the typecheck ran once, with the all on build)
  ctx.webIsAllOn = false;
  step(dir, "web", node, [viteBin, "build"], env, webDir);
  ctx.webIsAllOn = !off.length;
  const installed = dumpModules(env);
  checkBundle(ctx.modules, installed);
  step(dir, "test", node, [script("test.mjs")], env);
  await checkServer(dir, env, installed);
  await checkMcp(dir, env, installed, ctx.allTools);
}

/** Puts the generated lists and the build back to all on; also runs after a failure or an interrupt */
function restore(ctx) {
  const demo = join(root, "data", "demo.db");
  if (!ctx.demoExisted) for (const f of [demo, `${demo}-wal`, `${demo}-shm`]) rmSync(f, { force: true });
  spawnSync(node, [script("gen-modules.mjs")], { cwd: root, env: baseEnv(), stdio: "ignore" });
  if (!ctx.distIsAllOn) spawnSync(node, [script("build.mjs")], { cwd: root, env: baseEnv(), stdio: "ignore" });
  if (!ctx.webIsAllOn) spawnSync(node, [viteBin, "build"], { cwd: webDir, env: baseEnv(), stdio: "ignore" });
}

async function main() {
  const started = Date.now();
  mkdirSync(logRoot, { recursive: true });
  const keys = discoverModules().map((m) => m.key);
  const demo = join(root, "data", "demo.db");
  const ctx = { seedDb: join(logRoot, "seed.db"), allTools: [], modules: discoverModules(), distIsAllOn: false, webIsAllOn: false, demoExisted: existsSync(demo) };
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { restore(ctx); process.exit(130); });
  const results = [];
  try {
    // the seeded database every case starts from: the demo seed written by the all on build
    const seedDir = join(logRoot, "seed");
    mkdirSync(seedDir, { recursive: true });
    step(seedDir, "build", node, [script("build.mjs")], baseEnv());
    ctx.distIsAllOn = true;
    ctx.allTools = dumpModules(baseEnv()).flatMap((m) => m.tools);
    npm(seedDir, "web", ["run", "build", "-w", "@fullfollow/web"], baseEnv());
    ctx.webIsAllOn = true;
    checkBundle(ctx.modules, ctx.modules);
    step(seedDir, "seed", node, [script("demo-seed.cjs")], baseEnv());
    copyFileSync(demo, ctx.seedDb);
    // `--only=a,b` runs just those cases (while fixing one)
    const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
    const cases = [...keys.map((k) => [k, [k]]), ["all-off", keys], ["all-on", []]].filter(([n]) => !only || only.includes(n));
    for (const [name, off] of cases) {
      let line;
      try {
        await runCase(name, off, ctx);
        line = `pass ${name}`;
      } catch (e) {
        line = `FAIL ${name}: ${e instanceof CheckError ? e.message : (e?.stack ?? e)}`.split(/\r?\n/)[0];
      }
      results.push(line);
      console.log(line);
    }
  } finally {
    restore(ctx);
  }
  const failed = results.filter((l) => l.startsWith("FAIL")).length;
  console.log(`${results.length - failed}/${results.length} cases passed in ${Math.round((Date.now() - started) / 1000)} s (logs: ${logRoot})`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});
