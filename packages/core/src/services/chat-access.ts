import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CHAT_FOLDER_PATH_MAX, CHAT_LOCAL_FOLDERS_MAX } from "../constants";
import { FFError, parse, row, type Ctx } from "../context";
import { defaultDbPath } from "../db/client";
import { m } from "../messages";

/** What the panel chat may do without asking: full authority, reading web pages, and the local folders it may read and write */
export interface ChatAccess {
  chat_full_access: boolean;
  chat_web_fetch: boolean;
  chat_local_files: boolean;
  chat_local_folders: string[];
}

const IS_WIN = process.platform === "win32";
/** Windows paths are compared without case, as the file system does */
const pathKey = (p: string) => (IS_WIN ? path.resolve(p).toLowerCase() : path.resolve(p));

/** `child` is `parent` or lies inside it */
export function pathWithin(child: string, parent: string): boolean {
  const rel = path.relative(pathKey(parent), pathKey(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** The folder of the database in use: Full Follow's data (the database, the chat's runtime files, the uploads) */
export const dataFolder = () => path.dirname(path.resolve(defaultDbPath()));

const read = (ctx: Ctx, key: string) => row<{ value: string }>(ctx, "SELECT value FROM settings WHERE key = ?", key)?.value;

function storedFolders(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((f): f is string => typeof f === "string") : [];
  } catch {
    return [];
  }
}

/** Every access switch is off until the owner turns it on */
export function chatAccessSettings(ctx: Ctx): ChatAccess {
  return {
    chat_full_access: read(ctx, "chat_full_access") === "1",
    chat_web_fetch: read(ctx, "chat_web_fetch") === "1",
    chat_local_files: read(ctx, "chat_local_files") === "1",
    chat_local_folders: storedFolders(read(ctx, "chat_local_folders")),
  };
}

const folderList = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  },
  z.array(z.string().trim().min(1).max(CHAT_FOLDER_PATH_MAX)).max(CHAT_LOCAL_FOLDERS_MAX),
);

/**
 * The folders a PUT brings, as they are stored: absolute paths of folders that exist, each once, none that is, holds or lies inside
 * Full Follow's data folder (Claude would otherwise reach the database and the chat's own runtime files).
 */
export function validFolders(value: unknown): string[] {
  const out: string[] = [];
  for (const raw of parse(folderList, value)) {
    if (!path.isAbsolute(raw)) throw new FFError("validation", m.settings.folderNotAbsolute(raw));
    const dir = path.resolve(raw);
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(dir);
    } catch {
      throw new FFError("validation", m.settings.folderMissing(dir));
    }
    if (!stat.isDirectory()) throw new FFError("validation", m.settings.folderNotDir(dir));
    const data = dataFolder();
    if (pathWithin(dir, data) || pathWithin(data, dir)) throw new FFError("validation", m.settings.folderData(dir));
    if (!out.some((f) => pathKey(f) === pathKey(dir))) out.push(dir);
  }
  return out;
}
