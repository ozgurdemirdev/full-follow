import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { defaultDbPath } from "@fullfollow/core";
import { BRIEF_FILE, CHAT_DATA_DIR, MCP_ENTRY, MCP_SERVER_NAME } from "./chat.config";
import { chatCwd } from "./claude-cli";

const SYSTEM_RULES = [
  "Sen Full Follow panelindeki Claude'sun. Özgür'le Türkçe, kısa ve net konuş.",
  "Full Follow veritabanı gerçeğin tek kaynağıdır: bilgiyi araçlardan oku, tahmin etme.",
  "Özgür adına hiçbir mesaj gönderme; sadece taslak hazırla.",
  "Call open only when Özgür explicitly asks to see or open a record; never as part of other work.",
  "Records: when a reply lists panel records (tasks, goals, people, companies, opportunities, drafts, templates, ideas, payments, posts, comments), write one short sentence and append a fenced block instead of describing the records in text:",
  '```ff-cards\n{"groups":[{"label":"Pzt 12 Ekim","items":[{"type":"task","id":7},{"type":"template","id":5,"person_id":12}]}]}\n```',
  "label is optional; item types: task, goal, person, company, opportunity, draft, template, idea, payment, post, comment; person_id on a template item shows it filled for that person. For the weekly plan use the plan tool (never files) and group the cards by day.",
  "Never invent a new template. If asked for one, propose the text in your reply and save it only after Özgür approves.",
  "Acknowledgements: if Özgür's whole message is only a closing or acknowledgement (tamam, tamamdır anladım, süpersin, eyvallah), reply with exactly [[ack]]. If he approves something you proposed (onaylıyorum, tamam yap), start the reply with [[ack]], do the work, and end with one short result line. If the message contains anything new (a question, a condition, an idea: tamamdır anladım, peki şöyle yapsak) do not use [[ack]]; answer normally.",
  'When he says he did something (hallettim), reply with [[ack]] plus at most one block: ```ff-suggest\n{"label":"Görev #7\'yi kapat","action":"task_done","id":7}\n```. The only action is task_done. Never close a task without his confirmation.',
].join("\n");

/** mcp.json passes the server's own database path, so the panel Claude writes to the same database (also a test copy) */
export function writeRuntimeFiles(pinnedNotes = "", brief = ""): void {
  fs.mkdirSync(CHAT_DATA_DIR, { recursive: true });
  const mcp = { mcpServers: { [MCP_SERVER_NAME]: { type: "stdio", command: process.execPath, args: [MCP_ENTRY], env: { FF_DB: defaultDbPath() } } } };
  fs.writeFileSync(path.join(CHAT_DATA_DIR, "mcp.json"), JSON.stringify(mcp, null, 2));
  const parts = [SYSTEM_RULES, pinnedNotes.trim() && `Sabit notlar:\n${pinnedNotes.trim()}`, brief.trim() && `Panel brief:\n${brief.trim()}`];
  fs.writeFileSync(path.join(CHAT_DATA_DIR, "system.md"), `${parts.filter(Boolean).join("\n\n")}\n`);
}

/** Setup problem shown by GET /api/chat/meta instead of failing per message */
export const mcpBuilt = () => fs.existsSync(MCP_ENTRY);

/** Short version id of the pinned notes text ("" when there are none) */
export const notesVersion = (notes: string) => (notes.trim() ? createHash("sha1").update(notes.trim()).digest("hex").slice(0, 12) : "");

/** The private brief next to the chat's working folder files; it holds business context, so it lives outside the repo and is only read, never copied */
export function readBrief(): string {
  try {
    return fs.readFileSync(path.join(chatCwd(), BRIEF_FILE), "utf8");
  } catch {
    return "";
  }
}
