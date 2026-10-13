import path from "node:path";
import { HttpException } from "@nestjs/common";
import { FILE_NAME_MAX } from "@fullfollow/core";

const SNIFF_BYTES = 8_192;

export interface UploadType {
  ext: string;
  mime: string;
  kind: string;
}
export interface Detected {
  mime: string;
  kind: string;
  ext: string;
}

export const refuse = (message: string, status = 400, code = "attachment") => new HttpException({ message, code }, status);
const startsWith = (b: Buffer, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/**
 * Real type from the first bytes, never from the name. Images and PDF are told apart by signature, Office files
 * (a zip container) by signature plus extension, text files by extension after a content check.
 * Only types listed in `types` are accepted.
 */
export function sniff(buf: Buffer, name: string, types: readonly UploadType[]): Detected {
  const by = (mime: string) => types.find((t) => t.mime === mime);
  const ext = path.extname(name).slice(1).toLowerCase();
  let t: UploadType | undefined;
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) t = by("image/png");
  else if (startsWith(buf, [0xff, 0xd8, 0xff])) t = by("image/jpeg");
  else if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) t = by("image/gif");
  else if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) t = by("image/webp");
  else if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) t = by("application/pdf");
  else if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) t = types.find((x) => x.kind === "office" && x.ext === ext);
  else {
    const text = types.find((x) => x.kind === "text" && x.ext === ext);
    if (!text) throw refuse("Bu dosya türü desteklenmiyor");
    if (buf.subarray(0, SNIFF_BYTES).includes(0)) throw refuse("Metin dosyası okunamadı");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      throw refuse("Metin dosyası UTF-8 olmalı");
    }
    t = text;
  }
  if (!t) throw refuse("Bu dosya türü desteklenmiyor");
  return { mime: t.mime, kind: t.kind, ext: t.mime === "image/jpeg" ? "jpg" : t.ext };
}

/** multer decodes names as latin1; restore UTF-8 and keep only the base name */
export const cleanName = (raw: string) => path.basename(Buffer.from(raw, "latin1").toString("utf8")).replace(/[\u0000-\u001f]/g, "").slice(-FILE_NAME_MAX) || "dosya";
