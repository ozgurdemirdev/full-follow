import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FFError, type Core } from "@fullfollow/core";
import { z } from "zod";
import { describer } from "./describe";
import { OPENED_LABEL_CHARS, TODAY_ROWS } from "./constants";
import { block, bulkText, kindName, list, mcpFormat, ok, todayText, useMcpDefs } from "./format";
import { m } from "./messages";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function run(fn: () => string) {
  try {
    return text(fn());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: m.error(msg) }], isError: true };
  }
}

/** Record types that have a page in the panel (what `open` may show) */
const CORE_OPENABLE = ["comment"];
const idOrName = z.union([z.number(), z.string()]);
const obj = z.record(z.string(), z.any());
/**
 * 12 araç (modüllerin kendi araçları ayrıca). Tanım metinleri her istekte bağlama girdiği için kısa tutulur.
 * Taslak onaylama ve "gönderildi" işaretleme MCP'de yoktur (sadece Özgür).
 */
export function registerTools(server: McpServer, core: Core) {
  // what the installed modules add: record formatting, description fragments, tools of their own
  const defs = core.modules.list().flatMap((mod) => (mod.mcp ? [mod.mcp] : []));
  useMcpDefs(defs);
  const describe = describer(defs);
  const openable = new Set([...CORE_OPENABLE, ...defs.flatMap((d) => Object.entries(d.entities ?? {}).filter(([, e]) => e.openable).map(([type]) => type))]);

  server.registerTool("today", {
    description: describe("today", [
      [100, m.tools.todayHead],
      [320, "."],
    ]),
    inputSchema: { limit: z.number().optional() },
  }, ({ limit }) => run(() => {
    // what the modules prepare for the day (the drafts module's follow-up drafts) goes into the view before it is written
    return todayText({ ...core.today(limit ?? TODAY_ROWS), ...Object.assign({}, ...defs.map((d) => d.todayData?.(core.mod) ?? {})) });
  }));

  server.registerTool("open", {
    description: describe("open", [
      [100, m.tools.openHead],
      [300, m.tools.openTail],
    ]),
    inputSchema: { type: z.string(), id: idOrName },
  }, ({ type, id }) => run(() => {
    const t = core.normalizeType(type);
    if (!openable.has(t)) throw new FFError("validation", m.openNoPage(t));
    const r = core.get(t, id);
    const row = r.row as Record<string, any>;
    const label = String(row.name ?? row.title ?? row.target_label ?? row.to_name ?? `#${r.id}`).slice(0, OPENED_LABEL_CHARS);
    // "(tür #id)": the panel chat reads the canonical record from this suffix
    return m.opened(label, r.type, r.id);
  }));

  server.registerTool("find", {
    description: describe("find", [
      [100, m.tools.findHead],
      [206, "|source|comment"],
      [220, "|sector|note|setting"],
      [304, "|tag"],
      [401, "|trash. "],
      [423, "{unanswered:true}(comment) "],
      [440, "{all:true}("],
      [500, m.tools.findDeleted],
      [604, "trash {type:'person'}."],
    ]),
    inputSchema: { type: z.string(), q: z.string().optional(), filter: obj.optional(), limit: z.number().optional(), offset: z.number().optional() },
  }, ({ type, q, filter, limit, offset }) => run(() => list(core.normalizeType(type), core.find(type, { q, filter, limit, offset }), offset ?? 0)));

  server.registerTool("get", {
    description: describe("get", [
      [100, m.tools.getHead],
      [203, "comments"],
      [220, "|people|notes"],
      [300, "|links"],
      [302, " (opportunity: "],
      [400, "comments,"],
      [400.2, "links,"],
      [402, "; "],
      [500, "; "],
      [601, ")."],
    ]),
    inputSchema: { type: z.string(), id: idOrName, with: z.array(z.string()).optional() },
  }, ({ type, id, with: w }) => run(() => block(core.get(type, id, w ?? []))));

  server.registerTool("save", {
    description: describe("save", [
      [100, m.tools.saveHead],
      [130, "source"],
      [133, m.tools.saveByName],
      [141, m.tools.saveDates],
      [144, "tag: {name,color}. "],
      [144.2, "note: {person,body}. "],
      [144.4, m.tools.saveLink],
      [146, m.tools.saveComment],
    ]),
    inputSchema: { type: z.string(), data: z.union([obj, z.array(obj)]), id: idOrName.optional() },
  }, ({ type, data, id }) => run(() => {
    const t = core.normalizeType(type);
    if (Array.isArray(data)) return bulkText(kindName(t), core.saveMany(type, data));
    const r = core.save(type, data, id);
    return t === "setting" ? ok(m.kind.setting, undefined, [], Object.keys(data).join(",")) : ok(kindName(t), r.row?.id ?? (typeof id === "number" ? id : undefined), r.effects);
  }));

  server.registerTool("move", {
    // the opportunity and project stage lists come from their modules
    description: describe("move", [
      [100, m.tools.moveHead],
    ]),
    inputSchema: { type: z.string(), id: idOrName, stage: z.string(), reason: z.string().optional() },
  }, ({ type, id, stage, reason }) => run(() => {
    const t = core.normalizeType(type);
    const r = core.move(type, id, stage, reason);
    return ok(kindName(t), r.row?.id, r.effects, `→ ${stage}`);
  }));

  server.registerTool("delete", {
    description: m.tools.deleteAll,
    inputSchema: { type: z.string(), id: idOrName, restore: z.boolean().optional() },
  }, ({ type, id, restore }) => run(() => {
    if (restore) return ok(m.restoredKind, undefined, core.restore(type, id).effects);
    core.remove(type, id);
    return m.deleted;
  }));

  // tools only an installed module has (the calendar's plan, the payments' pay, ...)
  for (const tool of defs.flatMap((d) => d.tools ?? [])) {
    const description = typeof tool.description === "string" ? tool.description : describe(tool.name, tool.description.map((x): [number, string] => [x.at, x.text]));
    server.registerTool(tool.name, { description, inputSchema: tool.input }, (args: any) => run(() => tool.run(core.ctx, args, mcpFormat)));
  }
}
