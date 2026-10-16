import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dataFolder, MCP_MODE_TOOLS, pathWithin, type ChatAccess, type ChatSessionKind } from "@fullfollow/core";
import { GUARDED_TOOLS } from "../constants";
import { m } from "../messages";
import { chatDataDir, CLI_ENV_NAMES, CLI_ENV_PREFIXES, DEFAULT_CHAT_CWD, ENV, FILE_READ_TOOLS, FILE_WRITE_TOOLS, MCP_TOOL_PREFIX, PERMISSION_TOOL, RUNTIME_FILES, TOOL_SEARCH, WEB_FETCH, WEB_SEARCH } from "./chat.config";

export interface CliTarget {
  command: string;
  /** leading args: the script path when the target is a .js file run by Node */
  prefix: string[];
}

export interface RunSession {
  id: number;
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

/** What a panel chat starts with: the owner's access settings, the Full Follow tools the MCP host has, and the chat's working folder */
export interface PanelTools {
  access: ChatAccess;
  mcpTools: readonly string[];
  cwd: string;
}

/** A folder as the CLI's permission rules name it: POSIX form, a Windows drive as /c, and a leading // for an absolute path */
export function rulePath(dir: string): string {
  const p = path.resolve(dir).replace(/\\/g, "/");
  const drive = /^([A-Za-z]):\//.exec(p);
  return drive ? `//${drive[1].toLowerCase()}${p.slice(2)}` : `/${p}`;
}

/**
 * The panel: the Full Follow tools but the guarded ones (delete, pay, save) run on the allowlist; every other call goes to the MCP
 * host's confirmation tool, which runs it, refuses it or asks the owner (service/permission-policy.ts). Web search always, page reading
 * only while it is allowed. Local files: the read and write tools, the allowed folders as extra working folders, and deny rules on the
 * data folder and on the chat's own working folder (a working folder is readable without asking); never Bash or any other tool.
 */
function panelArgs(s: RunSession, p: PanelTools): string[] {
  const { access } = p;
  const web = [WEB_SEARCH, ...(access.chat_web_fetch ? [WEB_FETCH] : [])];
  const files: string[] = access.chat_local_files ? [...FILE_READ_TOOLS, ...FILE_WRITE_TOOLS] : [];
  const guarded: readonly string[] = [...GUARDED_TOOLS, PERMISSION_TOOL];
  const args = [
    "--mcp-config", path.join(chatDataDir(), RUNTIME_FILES.chatMcp(s.id)),
    "--permission-prompt-tool", `${MCP_TOOL_PREFIX}${PERMISSION_TOOL}`,
    "--allowedTools", ...p.mcpTools.filter((t) => !guarded.includes(t)).map((t) => `${MCP_TOOL_PREFIX}${t}`), ...web,
    "--tools", [TOOL_SEARCH, ...web, ...files].join(","),
  ];
  if (!files.length) return args;
  const folders = access.chat_local_folders;
  const blocked = [dataFolder(), ...(folders.some((f) => pathWithin(p.cwd, f)) ? [] : [p.cwd])];
  args.push("--disallowedTools", ...blocked.flatMap((dir) => [`Read(${rulePath(dir)})`, `Read(${rulePath(dir)}/**)`, `Edit(${rulePath(dir)}/**)`]));
  if (folders.length) args.push("--add-dir", ...folders);
  return args;
}

/**
 * What a session may use. A draft run: only the read tools and `draft`, by name, and no built-in tool but the tool search; its MCP
 * host runs in mode "draft", so the other tools do not exist there either. The panel: see panelArgs.
 */
function toolArgs(s: RunSession, panel?: PanelTools): string[] {
  if (s.kind === "draft" || !panel) {
    return [
      "--mcp-config", path.join(chatDataDir(), RUNTIME_FILES.draftMcp),
      "--allowedTools", ...MCP_MODE_TOOLS.draft.map((t) => `${MCP_TOOL_PREFIX}${t}`),
      "--tools", TOOL_SEARCH,
    ];
  }
  return panelArgs(s, panel);
}

/** User text never appears here: it goes through stdin only. Model and effort are pre-validated against the whitelists. */
export function buildArgv(s: RunSession, panel?: PanelTools): string[] {
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
    ...toolArgs(s, panel),
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
export function spawnClaude(target: CliTarget, s: RunSession, panel?: Omit<PanelTools, "cwd">): ChildProcess {
  const env = cliEnv();
  if (process.env[ENV.configDir]) env.CLAUDE_CONFIG_DIR = process.env[ENV.configDir];
  const cwd = chatCwd();
  return spawn(target.command, [...target.prefix, ...buildArgv(s, panel && { ...panel, cwd })], {
    cwd, env, shell: false, windowsHide: true, detached: !IS_WIN, stdio: ["pipe", "pipe", "pipe"],
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
