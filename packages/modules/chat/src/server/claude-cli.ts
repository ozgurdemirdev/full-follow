import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CHAT_DATA_DIR, DEFAULT_CHAT_CWD, ENV, MCP_SERVER_NAME, TOOL_SEARCH, WEB_TOOLS } from "./chat.config";

export interface CliTarget {
  command: string;
  /** leading args: the script path when the target is a .js file run by Node */
  prefix: string[];
}

export interface RunSession {
  model: string;
  effort: string;
  cli_session_id: string;
  cli_started: boolean;
}

const IS_WIN = process.platform === "win32";
let cached: CliTarget | null | undefined;

const fromFile = (file: string): CliTarget => (file.endsWith(".js") || file.endsWith(".cjs") || file.endsWith(".mjs") ? { command: process.execPath, prefix: [file] } : { command: file, prefix: [] });

/** The npm shim on Windows is a .cmd file that calls the real binary: read its target, never run a shell */
function targetOfCmdShim(cmd: string): string | null {
  const m = /"%dp0%\\([^"]+?\.(?:js|cjs|mjs|exe))"/i.exec(fs.readFileSync(cmd, "utf8"));
  return m ? path.resolve(path.dirname(cmd), m[1]) : null;
}

function findOnPath(): string | null {
  const names = IS_WIN ? ["claude.exe", "claude.cmd"] : ["claude"];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const n of names) {
      const f = path.join(dir, n);
      if (!fs.existsSync(f)) continue;
      if (f.endsWith(".cmd")) {
        const t = targetOfCmdShim(f);
        if (t && fs.existsSync(t)) return t;
      } else {
        return fs.realpathSync(f);
      }
    }
  }
  return null;
}

/** Resolved once and cached; null means the CLI is not installed (chat shows the cli_missing error) */
export function resolveCli(): CliTarget | null {
  if (cached !== undefined) return cached;
  const env = process.env[ENV.cli];
  const file = env && fs.existsSync(env) ? env : findOnPath();
  return (cached = file ? fromFile(file) : null);
}

/** FF_CHAT_CWD, else the business folder, else data/chat (with a warning) */
export function chatCwd(): string {
  const want = process.env[ENV.cwd] || DEFAULT_CHAT_CWD;
  if (fs.existsSync(want)) return want;
  console.warn(`  Sohbet çalışma klasörü yok (${want}), ${CHAT_DATA_DIR} kullanılıyor`);
  return CHAT_DATA_DIR;
}

/** User text never appears here: it goes through stdin only. Model and effort are pre-validated against the whitelists. */
export function buildArgv(s: RunSession): string[] {
  return [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model", s.model,
    "--effort", s.effort,
    s.cli_started ? "--resume" : "--session-id", s.cli_session_id,
    "--strict-mcp-config",
    "--mcp-config", path.join(CHAT_DATA_DIR, "mcp.json"),
    "--allowedTools", `mcp__${MCP_SERVER_NAME}`, ...WEB_TOOLS,
    "--tools", [TOOL_SEARCH, ...WEB_TOOLS].join(","),
    "--setting-sources", "project",
    "--append-system-prompt-file", path.join(CHAT_DATA_DIR, "system.md"),
  ];
}

/** shell: false always; on POSIX the process leads its own group so the whole tree can be killed */
export function spawnClaude(target: CliTarget, s: RunSession): ChildProcess {
  const env = { ...process.env };
  if (process.env[ENV.configDir]) env.CLAUDE_CONFIG_DIR = process.env[ENV.configDir];
  return spawn(target.command, [...target.prefix, ...buildArgv(s)], {
    cwd: chatCwd(), env, shell: false, windowsHide: true, detached: !IS_WIN, stdio: ["pipe", "pipe", "pipe"],
  });
}

/** child.kill() leaves grandchildren (the MCP server) alive on Windows, so kill the tree */
export function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid || child.exitCode !== null) return;
  if (IS_WIN) {
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => {});
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    child.kill("SIGKILL");
  }
}
