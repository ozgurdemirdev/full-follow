import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath, MCP_CHAT_SESSION_ENV, MCP_MODE_ENV, type ChatAccess } from "@fullfollow/core";
import { NOTES_VERSION_CHARS } from "../constants";
import { m, type RulesAccess } from "../messages";
import { BRIEF_FILE, chatDataDir, MCP_ENTRY, MCP_SERVER_NAME, RUNTIME_FILES } from "./chat.config";
import { chatCwd } from "./claude-cli";

const mcpConfig = (env: Record<string, string>) =>
  JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: process.execPath, args: [MCP_ENTRY], env: { FF_DB: defaultDbPath(), ...env } } } }, null, 2);

/** The access settings as the rules speak of them: the folders count only while local files are on */
export const rulesAccess = (a: ChatAccess): RulesAccess => ({ fullAccess: a.chat_full_access, webFetch: a.chat_web_fetch, folders: a.chat_local_files ? a.chat_local_folders : null });

/**
 * The MCP configs pass the server's own database path, so Claude writes to the same database (also a test copy). A draft run's config
 * starts the host in mode "draft": it registers only the read tools and `draft`, whatever the CLI is told.
 * system.md: the rules (with the owner's name and what the owner allowed), the pinned notes, the brief.
 */
export function writeRuntimeFiles(owner: string | null, pinnedNotes = "", brief = "", access?: RulesAccess): void {
  const dir = chatDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, RUNTIME_FILES.draftMcp), mcpConfig({ [MCP_MODE_ENV]: "draft" }));
  const parts = [m.systemRules(owner, access), pinnedNotes.trim() && m.pinnedNotes(pinnedNotes.trim()), brief.trim() && m.panelBrief(brief.trim())];
  fs.writeFileSync(path.join(dir, RUNTIME_FILES.system), `${parts.filter(Boolean).join("\n\n")}\n`);
}

/** A panel chat's MCP config: its host knows the session, so the confirmations it asks for reach that chat's window */
export function writeChatMcp(sessionId: number): void {
  const dir = chatDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, RUNTIME_FILES.chatMcp(sessionId)), mcpConfig({ [MCP_CHAT_SESSION_ENV]: String(sessionId) }));
}

/** Server start: the configs of the chats of the last run go (each is written again when its chat starts) */
export function removeChatMcps(): void {
  try {
    for (const f of fs.readdirSync(chatDataDir())) if (RUNTIME_FILES.chatMcpPattern.test(f)) fs.rmSync(path.join(chatDataDir(), f), { force: true });
  } catch {
    /* no chat folder yet */
  }
}

/** Setup problem shown by GET /api/chat/meta instead of failing per message */
export const mcpBuilt = () => fs.existsSync(MCP_ENTRY);

/** Short version id of the pinned notes text ("" when there are none) */
export const notesVersion = (notes: string) => (notes.trim() ? createHash("sha1").update(notes.trim()).digest("hex").slice(0, NOTES_VERSION_CHARS) : "");

/** The private brief next to the chat's working folder files; it holds business context, so it lives outside the repo and is only read, never copied */
export function readBrief(): string {
  try {
    return fs.readFileSync(path.join(chatCwd(), BRIEF_FILE), "utf8");
  } catch {
    return "";
  }
}
