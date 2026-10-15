import type { ChatMeta } from "./api";
import { T } from "./messages";

const BYTES_PER_MB = 1024 * 1024;
const KB = 1024;

export const fmtBytes = (b: number) => (b < BYTES_PER_MB ? `${Math.max(1, Math.round(b / KB))} KB` : `${(b / BYTES_PER_MB).toFixed(1).replace(".", ",")} MB`);

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const typeOf = (file: File, meta: ChatMeta) => meta.attachment_types.find((t) => t.mime === file.type || t.ext === extOf(file.name));

/** The `accept` attribute of the file input, from the server's list */
export const acceptAttr = (meta: ChatMeta | null) => (meta ? meta.attachment_types.flatMap((t) => [t.mime, `.${t.ext}`]).join(",") : "");

export const isImage = (file: { type?: string; mime?: string }) => (file.type ?? file.mime ?? "").startsWith("image/");

/** Why a file is refused (shown under the composer), or null when it can be added */
export function refuseReason(file: File, have: number, meta: ChatMeta): string | null {
  if (have >= meta.limits.maxAttachments) return T.tooMany(meta.limits.maxAttachments);
  const t = typeOf(file, meta);
  if (!t) return T.badType(file.name);
  if (t.kind === "image" && file.size > meta.limits.maxImageBytes) return T.tooBigImage(meta.limits.maxImageBytes / BYTES_PER_MB);
  if (file.size > meta.limits.maxFileBytes) return T.tooBigFile(meta.limits.maxFileBytes / BYTES_PER_MB);
  return null;
}
