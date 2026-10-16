import path from "node:path";
import { defaultDbPath } from "@fullfollow/core";
import { m } from "../messages";

export { CHAT_ATTACHMENT_TYPES } from "@fullfollow/core";
export { CHAT_DEFAULTS, CHAT_EFFORTS, CHAT_ERROR_TEXT, CHAT_LIMITS, CHAT_MODELS, CLI_ENV_NAMES, CLI_ENV_PREFIXES, type ChatErrorCode } from "../constants";

/** Repo root: this file compiles to packages/modules/chat/dist/server/ */
export const REPO_ROOT = path.resolve(__dirname, "../../../../..");
/** Runtime files of the chat (mcp.json, system.md, uploads) sit next to the database in use, so each FF_DB has its own folder; git ignored. A function: FF_DB may come from .env, which loads after this file */
export const chatDataDir = () => path.join(path.dirname(defaultDbPath()), "chat");
export const MCP_ENTRY = path.join(REPO_ROOT, "packages", "mcp", "dist", "index.js");
/** Business folder whose CLAUDE.md gives the panel Claude its context; the file tools never reach it unless the owner allows it as a folder */
export const DEFAULT_CHAT_CWD = "C:/Projects/Networking";

export const ENV = { cli: "FF_CLAUDE_CLI", cwd: "FF_CHAT_CWD", configDir: "FF_CLAUDE_CONFIG_DIR" } as const;

export { FILE_READ_TOOLS, FILE_WRITE_TOOLS, MCP_SERVER_NAME, MCP_TOOL_PREFIX, PERMISSION_TOOL } from "../constants";
/**
 * Runtime files in chatDataDir(): the system prompt, the MCP config of a draft run (the host in mode "draft"), and one MCP config per
 * panel chat (`mcp-chat-<session id>.json`), which tells its host the session its confirmations belong to
 */
export const RUNTIME_FILES = { system: "system.md", draftMcp: "mcp-draft.json", chatMcp: (sessionId: number) => `mcp-chat-${sessionId}.json`, chatMcpPattern: /^mcp-chat-\d+\.json$/ } as const;
export const TOOL_SEARCH = "ToolSearch";
/** Built-in web tools of the panel Claude: search always, reading a page only while the owner allows it (setting `chat_web_fetch`); page content is untrusted, see the rules */
export const WEB_SEARCH = "WebSearch";
export const WEB_FETCH = "WebFetch";
export const TOOL_SEARCH_LABEL = m.toolSearchLabel;
export const TOOL_SUMMARY_CHARS = 80;
/** After closing stdin, how long a process gets to exit before it is killed */
export const GRACEFUL_EXIT_MS = 2_000;
export const STDERR_LOG_CHARS = 500;
/** Claude answers an acknowledgement with this marker; it is held back, stripped and stored as chat_messages.ack */
export const ACK_MARKER = "[[ack]]";
/** Name of the private brief in the chat working folder (outside the repo); appended to system.md when it exists */
export const BRIEF_FILE = "panel-brief.md";
/** Hidden block sent once when the pinned notes changed after a chat started (never stored, never shown) */
export const NOTES_UPDATE = m.notesUpdate;
export const NOTES_CLEARED = m.notesCleared;
/** Hidden block added to the user message of a dictated message (never stored in body, never returned, never rendered) */
export const VOICE_NOTE = m.voiceNote;
