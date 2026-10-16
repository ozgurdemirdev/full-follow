import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { BadRequestException } from "@nestjs/common";
import { assertUploadRoom, cleanName, FILE_LIMITS, FILE_TYPES, refuse, sniff, uploadDir } from "@fullfollow/core";
import type { Core } from "./core.provider";
import { m } from "./messages";

/** Uploaded record files live next to the database (data/files by default, so a throwaway FF_DB gets its own folder) */
export const filesDir = () => uploadDir("files");
const mb = m.files.megabytes;

/** Check type and size, write the bytes under a random name, then record the file in core */
export function saveRecordFile(core: Core, body: { target_type?: string; target_id?: string }, file: { originalname: string; buffer: Buffer; size: number } | undefined) {
  if (!file) throw new BadRequestException(m.files.required);
  const name = cleanName(file.originalname);
  const d = sniff(file.buffer, name, FILE_TYPES);
  if (d.kind === "image" && file.size > FILE_LIMITS.maxImageBytes) throw refuse(m.files.imageTooBig(mb(FILE_LIMITS.maxImageBytes)), 413, "file");
  if (file.size > FILE_LIMITS.maxFileBytes) throw refuse(m.files.fileTooBig(mb(FILE_LIMITS.maxFileBytes)), 413, "file");
  assertUploadRoom(file.size);
  const stored_name = `${randomUUID()}.${d.ext}`;
  // the record is validated first (target exists), so a bad request leaves no orphan bytes
  const r = core.files.create({ target_type: body.target_type, target_id: body.target_id, name, mime: d.mime, size: file.size, stored_name });
  fs.mkdirSync(filesDir(), { recursive: true });
  fs.writeFileSync(path.join(filesDir(), stored_name), file.buffer);
  return r;
}

/** Stored file of a record: the row and its path on disk */
export function recordFile(core: Core, id: number) {
  const row = core.files.get(id);
  const full = path.join(filesDir(), path.basename(row.stored_name));
  if (!fs.existsSync(full)) throw refuse(m.files.notFound, 404, "file");
  return { row, full };
}
