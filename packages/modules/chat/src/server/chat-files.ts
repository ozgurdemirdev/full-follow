import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath } from "@fullfollow/core";
import { NOTES_VERSION_CHARS } from "../constants";
import { m } from "../messages";
import { BRIEF_FILE, CHAT_DATA_DIR, MCP_ENTRY, MCP_SERVER_NAME } from "./chat.config";
import { chatCwd } from "./claude-cli";

/** The rules of the panel Claude, written to system.md (their text lives in the messages file) */
export const SYSTEM_RULES = m.systemRules;

/** mcp.json passes the server's own database path, so the panel Claude writes to the same database (also a test copy) */
export function writeRuntimeFiles(pinnedNotes = "", brief = ""): void {
  fs.mkdirSync(CHAT_DATA_DIR, { recursive: true });
  const mcp = { mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: process.execPath, args: [MCP_ENTRY], env: { FF_DB: defaultDbPath() } } } };
  fs.writeFileSync(path.join(CHAT_DATA_DIR, "mcp.json"), JSON.stringify(mcp, null, 2));
  const parts = [SYSTEM_RULES, pinnedNotes.trim() && m.pinnedNotes(pinnedNotes.trim()), brief.trim() && m.panelBrief(brief.trim())];
  fs.writeFileSync(path.join(CHAT_DATA_DIR, "system.md"), `${parts.filter(Boolean).join("\n\n")}\n`);
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
