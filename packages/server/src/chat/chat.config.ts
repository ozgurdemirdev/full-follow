import path from "node:path";

export { CHAT_DEFAULTS, CHAT_EFFORTS, CHAT_ERROR_TEXT, CHAT_LIMITS, CHAT_MODELS, type ChatErrorCode } from "@fullfollow/core";

/** Repo root: this file compiles to packages/server/dist/chat/ */
export const REPO_ROOT = path.resolve(__dirname, "../../../..");
/** Runtime files of the chat (mcp.json, system.md); git ignored */
export const CHAT_DATA_DIR = path.join(REPO_ROOT, "data", "chat");
export const MCP_ENTRY = path.join(REPO_ROOT, "packages", "mcp", "dist", "index.js");
/** Business folder whose CLAUDE.md gives the panel Claude its context; file tools stay disabled */
export const DEFAULT_CHAT_CWD = "C:/Projects/Networking";

export const ENV = { cli: "FF_CLAUDE_CLI", cwd: "FF_CHAT_CWD", configDir: "FF_CLAUDE_CONFIG_DIR" } as const;

export const MCP_SERVER_NAME = "full-follow";
export const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;
export const TOOL_SEARCH = "ToolSearch";
export const TOOL_SEARCH_LABEL = "Araçlar hazırlanıyor";
export const TOOL_SUMMARY_CHARS = 80;
export const DISALLOWED_TOOLS = ["Bash", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Read", "Glob", "Grep", "Task"] as const;
/** After closing stdin, how long a process gets to exit before it is killed */
export const GRACEFUL_EXIT_MS = 2_000;
export const STDERR_LOG_CHARS = 500;
