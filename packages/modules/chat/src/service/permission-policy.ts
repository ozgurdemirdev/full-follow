import fs from "node:fs";
import path from "node:path";
import { dataFolder, money, normalizeType, OWNER_ONLY_SETTINGS, pathWithin, resolveId, row, type ChatAccess, type Ctx } from "@fullfollow/core";
import { DELETE_TOOL, FILE_READ_TOOLS, FILE_WRITE_TOOLS, MCP_TOOL_PREFIX, PAY_TOOL, PERMISSION_LIMITS, SETTING_WRITE_TOOL } from "../constants";
import { m } from "../messages";

/** What the confirmation tool answers a tool call of the panel chat with: run it, refuse it, or ask the owner with this summary */
export type Decision = { kind: "allow" } | { kind: "deny"; message: string } | { kind: "ask"; summary: string };
type Input = Record<string, unknown>;

const ALLOW: Decision = { kind: "allow" };
const deny = (message: string): Decision => ({ kind: "deny", message });
const short = (v: unknown) => {
  const t = typeof v === "string" ? v : JSON.stringify(v) ?? "";
  return t.length > PERMISSION_LIMITS.valueChars ? `${t.slice(0, PERMISSION_LIMITS.valueChars)}…` : t;
};
/** A long path keeps its end: the folder and the file name are what the owner must see */
const shortPath = (p: string) => (p.length > PERMISSION_LIMITS.valueChars ? `…${p.slice(-PERMISSION_LIMITS.valueChars)}` : p);
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);

/** The record a delete names: its Turkish noun and, when it can be read, its name */
function deleteSummary(ctx: Ctx, input: Input): string {
  const rawType = String(input.type ?? "");
  const rawId = input.id as string | number;
  try {
    const type = normalizeType(ctx, rawType);
    const id = resolveId(ctx, type, rawId);
    const rec = ctx.types.entity(type)?.get?.(ctx, id);
    const name = rec ? (rec.name ?? rec.title ?? rec.label ?? null) : null;
    return m.permission.deleteRecord(cap(ctx.types.label(type) ?? type), name === null ? null : short(name), id);
  } catch {
    return m.permission.deleteRecord(cap(rawType), null, short(rawId));
  }
}

/** A payment's project and milestone; a read of the projects module's tables, so the summary works without calling the module */
function paySummary(ctx: Ctx, input: Input): string {
  const id = Number(input.payment_id);
  const p = row<{ milestone: string; project: string | null }>(ctx, "SELECT p.milestone, pr.name AS project FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id WHERE p.id = ?", id);
  return m.permission.pay(money(Number(input.amount) || 0), id, p?.project ?? null, p?.milestone ?? null, typeof input.date === "string" ? input.date : null);
}

function isSettingType(ctx: Ctx, type: unknown): boolean {
  try {
    return normalizeType(ctx, String(type ?? "")) === "setting";
  } catch {
    return false;
  }
}

function decideFullFollow(ctx: Ctx, tool: string, input: Input, full: boolean): Decision {
  const ask = (summary: () => string): Decision => (full ? ALLOW : { kind: "ask", summary: summary() });
  if (tool === DELETE_TOOL) return input.restore === true ? ALLOW : ask(() => deleteSummary(ctx, input));
  if (tool === PAY_TOOL) return ask(() => paySummary(ctx, input));
  if (tool === SETTING_WRITE_TOOL && isSettingType(ctx, input.type)) {
    const items = (Array.isArray(input.data) ? input.data : [input.data]).filter((d): d is Input => !!d && typeof d === "object");
    const keys = items.flatMap((d) => Object.keys(d));
    const owners = keys.filter((k) => (OWNER_ONLY_SETTINGS as readonly string[]).includes(k));
    // core refuses these for Claude anyway: asking the owner first would only end in that error
    if (owners.length) return deny(m.permission.ownerOnly(owners.join(", ")));
    return ask(() => m.permission.setting(items.flatMap((d) => Object.entries(d).map(([k, v]) => m.permission.settingChange(k, short(v)))).join(", ")));
  }
  return ALLOW;
}

/** The real folder a path is in: the deepest part that exists, links resolved (a link inside an allowed folder may point anywhere) */
function realPath(p: string): string {
  let cur = path.resolve(p);
  const rest: string[] = [];
  while (!fs.existsSync(cur)) {
    const up = path.dirname(cur);
    if (up === cur) break;
    rest.unshift(path.basename(cur));
    cur = up;
  }
  try {
    return path.join(fs.realpathSync(cur), ...rest);
  } catch {
    return path.resolve(p);
  }
}

/** Inside one of the allowed folders and never in Full Follow's data folder */
export function inFolders(p: unknown, folders: string[]): p is string {
  if (typeof p !== "string" || !path.isAbsolute(p)) return false;
  const real = realPath(p);
  if (pathWithin(real, dataFolder())) return false;
  return folders.some((f) => pathWithin(real, realPath(f)));
}

function decideFile(tool: string, input: Input, access: ChatAccess): Decision {
  const target = tool === "Glob" || tool === "Grep" ? input.path : input.file_path;
  if (!inFolders(target, access.chat_local_folders)) return deny(m.permission.outside);
  if ((FILE_READ_TOOLS as readonly string[]).includes(tool)) return ALLOW;
  // a new file is created at once; changing one that exists asks
  if (tool === "Write" && !fs.existsSync(target)) return ALLOW;
  if (access.chat_full_access) return ALLOW;
  return { kind: "ask", summary: (tool === "Edit" ? m.permission.editFile : m.permission.overwriteFile)(shortPath(target)) };
}

/**
 * The single place that decides a tool call the Claude CLI could not run on its own allowlist: deleting, paying and writing a setting
 * ask the owner (nothing asks with full authority), the other Full Follow tools run, the file tools stay inside the allowed folders,
 * and any other tool is refused.
 */
export function decide(ctx: Ctx, toolName: string, input: Input, access: ChatAccess): Decision {
  if (toolName.startsWith(MCP_TOOL_PREFIX)) return decideFullFollow(ctx, toolName.slice(MCP_TOOL_PREFIX.length), input, access.chat_full_access);
  const fileTools: readonly string[] = [...FILE_READ_TOOLS, ...FILE_WRITE_TOOLS];
  if (access.chat_local_files && fileTools.includes(toolName)) return decideFile(toolName, input, access);
  return deny(m.permission.unavailable);
}
