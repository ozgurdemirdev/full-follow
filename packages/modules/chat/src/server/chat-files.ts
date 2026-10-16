import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath, MCP_MODE_ENV } from "@fullfollow/core";
import { NOTES_VERSION_CHARS } from "../constants";
import { m } from "../messages";
import { BRIEF_FILE, chatDataDir, MCP_ENTRY, MCP_SERVER_NAME, RUNTIME_FILES } from "./chat.config";
import { chatCwd } from "./claude-cli";

/** The rules of the panel Claude, written to system.md (their text lives in the messages file) */
export const SYSTEM_RULES = m.systemRules;

const mcpConfig = (env: Record<string, string>) =>
  JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: process.execPath, args: [MCP_ENTRY], env: { FF_DB: defaultDbPath(), ...env } } } }, null, 2);

/**
 * The MCP configs pass the server's own database path, so Claude writes to the same database (also a test copy). A draft run's config
 * starts the host in mode "draft": it registers only the read tools and `draft`, whatever the CLI is told.
 */
export function writeRuntimeFiles(pinnedNotes = "", brief = ""): void {
  const dir = chatDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, RUNTIME_FILES.mcp), mcpConfig({}));
  fs.writeFileSync(path.join(dir, RUNTIME_FILES.draftMcp), mcpConfig({ [MCP_MODE_ENV]: "draft" }));
  const parts = [SYSTEM_RULES, pinnedNotes.trim() && m.pinnedNotes(pinnedNotes.trim()), brief.trim() && m.panelBrief(brief.trim())];
  fs.writeFileSync(path.join(dir, RUNTIME_FILES.system), `${parts.filter(Boolean).join("\n\n")}\n`);
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
