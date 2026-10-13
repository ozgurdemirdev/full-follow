import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Core } from "../core.provider";
import { cleanName, refuse, sniff } from "../upload";
import { CHAT_ATTACHMENT_TYPES, CHAT_DATA_DIR, CHAT_LIMITS } from "./chat.config";

const UPLOAD_DIR = path.join(CHAT_DATA_DIR, "uploads");

export function saveUpload(core: Core, sessionId: number, file: { originalname: string; buffer: Buffer; size: number }) {
  core.chat.getSession(sessionId);
  const name = cleanName(file.originalname);
  const d = sniff(file.buffer, name, CHAT_ATTACHMENT_TYPES);
  if (d.kind === "image" && file.size > CHAT_LIMITS.maxImageBytes) throw refuse("Resim en fazla 5 MB olabilir", 413);
  if (file.size > CHAT_LIMITS.maxFileBytes) throw refuse("Dosya en fazla 10 MB olabilir", 413);
  const dir = path.join(UPLOAD_DIR, String(sessionId));
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, `${randomUUID()}.${d.ext}`);
  fs.writeFileSync(full, file.buffer);
  const row = core.chat.createAttachment(sessionId, { name, mime: d.mime, size: file.size, path: full });
  return { id: row.id, name: row.name, size: row.size, mime: row.mime };
}

export function attachmentFile(core: Core, id: number) {
  const row = core.chat.getAttachment(id);
  if (!fs.existsSync(row.path)) throw refuse("Dosya bulunamadı", 404);
  return row;
}

type Block = { type: "text"; text: string } | { type: "image" | "document"; source: { type: "base64"; media_type: string; data: string } };

/** Stdin content blocks of one user message: images and PDF as base64, text files inlined (cut at maxTextAttachmentChars) */
export function attachmentBlocks(core: Core, messageId: number): Block[] {
  return core.chat.attachmentsOfMessage(messageId).map((a): Block => {
    if (!fs.existsSync(a.path)) return { type: "text", text: `(dosya okunamadı: ${a.name})` };
    const kind = CHAT_ATTACHMENT_TYPES.find((t) => t.mime === a.mime)?.kind;
    if (kind === "text") {
      const text = fs.readFileSync(a.path, "utf8");
      const cut = text.length > CHAT_LIMITS.maxTextAttachmentChars;
      return { type: "text", text: `<file name="${a.name.replace(/"/g, "'")}">${cut ? text.slice(0, CHAT_LIMITS.maxTextAttachmentChars) + "\n(dosya burada kesildi)" : text}</file>` };
    }
    return { type: kind === "pdf" ? "document" : "image", source: { type: "base64", media_type: a.mime, data: fs.readFileSync(a.path).toString("base64") } };
  });
}
