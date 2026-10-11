import fs from "node:fs";
import path from "node:path";
import { defaultDbPath } from "@fullfollow/core";
import { CHAT_DATA_DIR, MCP_ENTRY, MCP_SERVER_NAME } from "./chat.config";

const SYSTEM_RULES = [
  "Sen Full Follow panelindeki Claude'sun. Özgür'le Türkçe, kısa ve net konuş.",
  "Full Follow veritabanı gerçeğin tek kaynağıdır: bilgiyi araçlardan oku, tahmin etme.",
  "Özgür adına hiçbir mesaj gönderme; sadece taslak hazırla.",
].join("\n");

/** mcp.json passes the server's own database path, so the panel Claude writes to the same database (also a test copy) */
export function writeRuntimeFiles(pinnedNotes = ""): void {
  fs.mkdirSync(CHAT_DATA_DIR, { recursive: true });
  const mcp = { mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: process.execPath, args: [MCP_ENTRY], env: { FF_DB: defaultDbPath() } } } };
  fs.writeFileSync(path.join(CHAT_DATA_DIR, "mcp.json"), JSON.stringify(mcp, null, 2));
  fs.writeFileSync(path.join(CHAT_DATA_DIR, "system.md"), pinnedNotes.trim() ? `${SYSTEM_RULES}\n\nSabit notlar:\n${pinnedNotes.trim()}\n` : `${SYSTEM_RULES}\n`);
}

/** Setup problem shown by GET /api/chat/meta instead of failing per message */
export const mcpBuilt = () => fs.existsSync(MCP_ENTRY);
