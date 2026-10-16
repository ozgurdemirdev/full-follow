import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MCP_MODE_TOOLS, type ChatSessionKind } from "@fullfollow/core";
import { m } from "../messages";
import { chatDataDir, CLI_ENV_NAMES, CLI_ENV_PREFIXES, DEFAULT_CHAT_CWD, ENV, MCP_SERVER_NAME, MCP_TOOL_PREFIX, RUNTIME_FILES, TOOL_SEARCH, WEB_TOOLS } from "./chat.config";

export interface CliTarget {
  command: string;
  /** leading args: the script path when the target is a .js file run by Node */
  prefix: string[];
}

export interface RunSession {
  kind: ChatSessionKind;
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
  console.warn(m.log.noCwd(want, chatDataDir()));
  return chatDataDir();
}

/**
 * What a session may use. The panel: every Full Follow tool and the web tools. A draft run: only the read tools and `draft`, by name,
 * and no built-in tool but the tool search; its MCP host runs in mode "draft", so the other tools do not exist there either.
 */
function toolArgs(kind: ChatSessionKind): string[] {
  if (kind === "draft") {
    return [
      "--mcp-config", path.join(chatDataDir(), RUNTIME_FILES.draftMcp),
      "--allowedTools", ...MCP_MODE_TOOLS.draft.map((t) => `${MCP_TOOL_PREFIX}${t}`),
      "--tools", TOOL_SEARCH,
    ];
  }
  return [
    "--mcp-config", path.join(chatDataDir(), RUNTIME_FILES.mcp),
    "--allowedTools", `mcp__${MCP_SERVER_NAME}`, ...WEB_TOOLS,
    "--tools", [TOOL_SEARCH, ...WEB_TOOLS].join(","),
  ];
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
    ...toolArgs(s.kind),
    "--setting-sources", "project",
    "--append-system-prompt-file", path.join(chatDataDir(), RUNTIME_FILES.system),
  ];
}

/** The server's environment reduced to what the CLI needs (the allowlist in constants.ts); the server's own secrets (FF_PASSWORD, FF_COOKIE_SECRET) never reach it */
export function cliEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const names = new Set<string>(CLI_ENV_NAMES);
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    const upper = key.toUpperCase();
    if (value !== undefined && (names.has(upper) || CLI_ENV_PREFIXES.some((p) => upper.startsWith(p)))) env[key] = value;
  }
  return env;
}

/** shell: false always; on POSIX the process leads its own group so the whole tree can be killed */
export function spawnClaude(target: CliTarget, s: RunSession): ChildProcess {
  const env = cliEnv();
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
