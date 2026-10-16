import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Core } from "@fullfollow/core";
import { cleanName, refuse, sniff } from "@fullfollow/core";
import { BYTES_PER_MB } from "../constants";
import { m } from "../messages";
import { CHAT_ATTACHMENT_TYPES, chatDataDir, CHAT_LIMITS } from "./chat.config";

export function saveUpload(core: Core, sessionId: number, file: { originalname: string; buffer: Buffer; size: number }) {
  core.mod("chat")!.getSession(sessionId);
  const name = cleanName(file.originalname);
  const d = sniff(file.buffer, name, CHAT_ATTACHMENT_TYPES);
  if (d.kind === "image" && file.size > CHAT_LIMITS.maxImageBytes) throw refuse(m.errors.imageTooBig(CHAT_LIMITS.maxImageBytes / BYTES_PER_MB), 413);
  if (file.size > CHAT_LIMITS.maxFileBytes) throw refuse(m.errors.fileTooBig(CHAT_LIMITS.maxFileBytes / BYTES_PER_MB), 413);
  const dir = path.join(chatDataDir(), "uploads", String(sessionId));
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, `${randomUUID()}.${d.ext}`);
  fs.writeFileSync(full, file.buffer);
  const row = core.mod("chat")!.createAttachment(sessionId, { name, mime: d.mime, size: file.size, path: full });
  return { id: row.id, name: row.name, size: row.size, mime: row.mime };
}

export function attachmentFile(core: Core, id: number) {
  const row = core.mod("chat")!.getAttachment(id);
  if (!fs.existsSync(row.path)) throw refuse(m.errors.fileMissing, 404);
  return row;
}

/**
 * A text attachment as Claude reads it. The file's own `<file` and `</file` are escaped, so a text cannot close its block and go
 * on as if the owner had written the rest; the name loses quotes, angle brackets and line breaks for the same reason.
 */
export function fileBlock(name: string, text: string): string {
  const safeName = name.replace(/["<>]/g, "'").replace(/\s+/g, " ");
  return `<file name="${safeName}">${text.replace(/<(\/?)file/gi, "&lt;$1file")}</file>`;
}

type Block ={ type: "text"; text: string } | { type: "image" | "document"; source: { type: "base64"; media_type: string; data: string } };

/** Stdin content blocks of one user message: images and PDF as base64, text files inlined (cut at maxTextAttachmentChars) */
export function attachmentBlocks(core: Core, messageId: number): Block[] {
  return core.mod("chat")!.attachmentsOfMessage(messageId).map((a): Block => {
    if (!fs.existsSync(a.path)) return { type: "text", text: m.unreadable(a.name) };
    const kind = CHAT_ATTACHMENT_TYPES.find((t) => t.mime === a.mime)?.kind;
    if (kind === "text") {
      const text = fs.readFileSync(a.path, "utf8");
      const cut = text.length > CHAT_LIMITS.maxTextAttachmentChars;
      return { type: "text", text: fileBlock(a.name, cut ? text.slice(0, CHAT_LIMITS.maxTextAttachmentChars) + m.cutHere : text) };
    }
    return { type: kind === "pdf" ? "document" : "image", source: { type: "base64", media_type: a.mime, data: fs.readFileSync(a.path).toString("base64") } };
  });
}
