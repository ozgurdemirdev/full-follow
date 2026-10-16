import fs from "node:fs";
import path from "node:path";
import { FILE_NAME_MAX, UPLOAD_DIRS, UPLOAD_QUOTA_BYTES } from "../constants";
import { defaultDbPath } from "../db/client";
import { m } from "../messages";

/** A folder of uploaded bytes beside the database in use, so a throwaway FF_DB gets its own */
export const uploadDir = (kind: keyof typeof UPLOAD_DIRS) => path.join(path.dirname(defaultDbPath()), UPLOAD_DIRS[kind]);

/** Bytes under a folder, its subfolders included; a missing folder is empty */
function folderBytes(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    total += e.isDirectory() ? folderBytes(full) : e.isFile() ? fs.statSync(full).size : 0;
  }
  return total;
}

/** Refuses an upload (413) that would take the uploaded bytes of every folder past the quota */
export function assertUploadRoom(incoming: number, quota = UPLOAD_QUOTA_BYTES): void {
  const used = Object.keys(UPLOAD_DIRS).reduce((sum, k) => sum + folderBytes(uploadDir(k as keyof typeof UPLOAD_DIRS)), 0);
  if (used + incoming > quota) throw refuse(m.uploadQuota(Math.round(quota / 1024 / 1024 / 1024)), 413, "quota");
}

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

/** An upload the server refuses: the HTTP status and an app code go out as `{ error, code }` (the server's error filter turns it into the response) */
export class HttpFailure extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = "HttpFailure";
  }
}

export const refuse = (message: string, status = 400, code = "attachment") => new HttpFailure(message, status, code);
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
    if (!text) throw refuse(m.files.unsupportedType);
    if (buf.subarray(0, SNIFF_BYTES).includes(0)) throw refuse(m.files.textUnreadable);
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
    } catch {
      throw refuse(m.files.textNotUtf8);
    }
    t = text;
  }
  if (!t) throw refuse(m.files.unsupportedType);
  return { mime: t.mime, kind: t.kind, ext: t.mime === "image/jpeg" ? "jpg" : t.ext };
}

/** multer decodes names as latin1; restore UTF-8 and keep only the base name */
export const cleanName = (raw: string) => path.basename(Buffer.from(raw, "latin1").toString("utf8")).replace(/[\u0000-\u001f]/g, "").slice(-FILE_NAME_MAX) || m.noun.file;
