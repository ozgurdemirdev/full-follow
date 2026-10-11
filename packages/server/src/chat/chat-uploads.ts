import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HttpException } from "@nestjs/common";
import type { Core } from "../core.provider";
import { CHAT_ATTACHMENT_TYPES, CHAT_DATA_DIR, CHAT_LIMITS } from "./chat.config";

const UPLOAD_DIR = path.join(CHAT_DATA_DIR, "uploads");
const SNIFF_BYTES = 8_192;
const NAME_MAX = 120;

type Kind = (typeof CHAT_ATTACHMENT_TYPES)[number]["kind"];
interface Detected {
  mime: string;
  kind: Kind;
  ext: string;
}

const refuse = (message: string, status = 400) => new HttpException({ message, code: "attachment" }, status);
const startsWith = (b: Buffer, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Real type from the first bytes, never from the name; text files are accepted by extension after a content check */
export function sniff(buf: Buffer, name: string): Detected {
  const by = (mime: string) => CHAT_ATTACHMENT_TYPES.find((t) => t.mime === mime)!;
  let t: (typeof CHAT_ATTACHMENT_TYPES)[number] | undefined;
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) t = by("image/png");
  else if (startsWith(buf, [0xff, 0xd8, 0xff])) t = by("image/jpeg");
  else if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) t = by("image/gif");
  else if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) t = by("image/webp");
  else if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) t = by("application/pdf");
  else {
    const ext = path.extname(name).slice(1).toLowerCase();
    const text = CHAT_ATTACHMENT_TYPES.find((x) => x.kind === "text" && x.ext === ext);
    if (!text) throw refuse("Bu dosya türü desteklenmiyor");
    if (buf.subarray(0, SNIFF_BYTES).includes(0)) throw refuse("Metin dosyası okunamadı");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      throw refuse("Metin dosyası UTF-8 olmalı");
    }
    t = text;
  }
  return { mime: t.mime, kind: t.kind, ext: t.mime === "image/jpeg" ? "jpg" : t.ext };
}

/** multer decodes names as latin1; restore UTF-8 and keep only the base name */
const cleanName = (raw: string) => path.basename(Buffer.from(raw, "latin1").toString("utf8")).replace(/[\u0000-\u001f]/g, "").slice(-NAME_MAX) || "dosya";

export function saveUpload(core: Core, sessionId: number, file: { originalname: string; buffer: Buffer; size: number }) {
  core.chat.getSession(sessionId);
  const name = cleanName(file.originalname);
  const d = sniff(file.buffer, name);
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
