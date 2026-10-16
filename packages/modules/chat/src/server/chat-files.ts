import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath } from "@fullfollow/core";
import { NOTES_VERSION_CHARS } from "../constants";
import { m } from "../messages";
import { BRIEF_FILE, chatDataDir, MCP_ENTRY, MCP_SERVER_NAME } from "./chat.config";
import { chatCwd } from "./claude-cli";

/** mcp.json passes the server's own database path, so the panel Claude writes to the same database (also a test copy). system.md: the rules (with the owner's name), the pinned notes, the brief */
export function writeRuntimeFiles(owner: string | null, pinnedNotes = "", brief = ""): void {
  const dir = chatDataDir();
  fs.mkdirSync(dir, { recursive: true });
  const mcp = { mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: process.execPath, args: [MCP_ENTRY], env: { FF_DB: defaultDbPath() } } } };
  fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify(mcp, null, 2));
  const parts = [m.systemRules(owner), pinnedNotes.trim() && m.pinnedNotes(pinnedNotes.trim()), brief.trim() && m.panelBrief(brief.trim())];
  fs.writeFileSync(path.join(dir, "system.md"), `${parts.filter(Boolean).join("\n\n")}\n`);
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
