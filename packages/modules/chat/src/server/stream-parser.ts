import { LOG_LINE_CHARS } from "../constants";
import { m } from "../messages";
import type { ChatErrorCode } from "./chat.config";
import { MCP_SERVER_NAME, MCP_TOOL_PREFIX, TOOL_SEARCH, TOOL_SEARCH_LABEL, TOOL_SUMMARY_CHARS } from "./chat.config";

export interface ToolRecord {
  name: string;
  summary: string;
  ok: boolean;
  /** set when an `open` call succeeded: the record that was opened (chip under the reply) */
  open?: { type: string; id: number; label: string };
}
export interface Usage {
  input_tokens: number;
  output_tokens: number;
}
export type ChatEvent =
  | { type: "ready"; model: string; mcp_ok: boolean }
  | { type: "status"; state: "thinking" | "tool" | "writing"; tool?: string }
  | { type: "delta"; text: string }
  | { type: "tools"; tools: ToolRecord[] }
  | { type: "context"; tokens: number }
  | { type: "navigate"; record_type: string; record_id: number }
  | { type: "limits"; five_hour: number | null; seven_day: number | null; five_resets_at: number | null; seven_resets_at: number | null; status: string }
  | { type: "done"; usage: Usage; cost_usd: number; context_tokens: number; fallback_text: string | null }
  | { type: "error"; raw: string };

type Json = Record<string, any>;

const toolName = (name: string) => (name === TOOL_SEARCH ? TOOL_SEARCH_LABEL : name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : name);
const sumTokens = (u: Json | undefined) => (u ? (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) : 0);
const OPEN_TOOL = "open";
/** `open` answers "açıldı: <label> (<type> #<id>)"; anything else (an error text) opens nothing */
function parseOpened(content: unknown): { type: string; id: number; label: string } | null {
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((c: Json) => c.text ?? "").join("") : "";
  const m = /^açıldı: (.*) \((\w+) #(\d+)\)\s*$/s.exec(text.trim());
  return m ? { label: m[1], type: m[2], id: Number(m[3]) } : null;
}
const clip = (s: string) => (s.length > TOOL_SUMMARY_CHARS ? `${s.slice(0, TOOL_SUMMARY_CHARS - 1)}…` : s);

/** Error text from a failed result → the code that picks the Turkish message */
export function errorCode(raw: string): ChatErrorCode {
  if (/authenticate|oauth|login/i.test(raw)) return "cli_auth";
  if (/usage limit|rate limit|limit reached|too many requests/i.test(raw)) return "cli_limit";
  return "unknown";
}

/**
 * One parser per turn: feed it stdout lines, get app events. Pure (no I/O); a CLI format change is a fix in this file only.
 * Reply text comes from text deltas only (never from `assistant` or `result`, that would duplicate it),
 * except a turn with zero deltas, which falls back to result.result.
 */
export function createParser() {
  const tools: ToolRecord[] = [];
  const byId = new Map<string, ToolRecord>();
  let context = 0;
  let deltas = 0;
  let writing = false;

  function handleStream(e: Json): ChatEvent[] {
    const out: ChatEvent[] = [];
    if (e.type === "content_block_start") {
      const b = e.content_block ?? {};
      writing = false;
      if (b.type === "thinking") out.push({ type: "status", state: "thinking" });
      else if (b.type === "tool_use") out.push({ type: "status", state: "tool", tool: toolName(String(b.name ?? "")) });
    } else if (e.type === "content_block_delta" && e.delta?.type === "text_delta") {
      if (!writing) out.push({ type: "status", state: "writing" });
      writing = true;
      deltas++;
      out.push({ type: "delta", text: String(e.delta.text ?? "") });
    } else if (e.type === "message_delta" && e.usage) {
      context = sumTokens(e.usage);
      out.push({ type: "context", tokens: context });
    }
    return out;
  }

  function handleAssistant(m: Json): ChatEvent[] {
    let added = false;
    for (const b of m.content ?? []) {
      if (b.type !== "tool_use" || b.name === TOOL_SEARCH) continue;
      const rec: ToolRecord = { name: toolName(b.name), summary: clip(JSON.stringify(b.input ?? {})), ok: true };
      tools.push(rec);
      byId.set(b.id, rec);
      added = true;
    }
    return added ? [{ type: "tools", tools: tools.map((t) => ({ ...t })) }] : [];
  }

  function handleUser(m: Json): ChatEvent[] {
    const out: ChatEvent[] = [];
    const nav: ChatEvent[] = [];
    let any = false;
    for (const b of Array.isArray(m.content) ? m.content : []) {
      if (b.type !== "tool_result") continue;
      any = true;
      const rec = byId.get(b.tool_use_id);
      if (rec) rec.ok = !b.is_error;
      const opened = rec && rec.name === OPEN_TOOL && !b.is_error ? parseOpened(b.content) : null;
      if (rec && opened) {
        rec.open = opened;
        nav.push({ type: "navigate", record_type: opened.type, record_id: opened.id });
      }
    }
    if (any) {
      if (tools.length) out.push({ type: "tools", tools: tools.map((t) => ({ ...t })) });
      out.push({ type: "status", state: "thinking" });
    }
    return [...out, ...nav];
  }

  function handleResult(o: Json): ChatEvent[] {
    const text = typeof o.result === "string" ? o.result : "";
    if (o.is_error || (o.subtype && o.subtype !== "success")) return [{ type: "error", raw: text || String(o.subtype ?? "") }];
    const u = o.usage ?? {};
    return [{
      type: "done",
      usage: { input_tokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), output_tokens: u.output_tokens ?? 0 },
      cost_usd: Number(o.total_cost_usd ?? 0),
      context_tokens: context || sumTokens(u),
      fallback_text: deltas === 0 && text ? text : null,
    }];
  }

  function feed(line: string): ChatEvent[] {
    let o: Json;
    try {
      o = JSON.parse(line);
    } catch {
      console.warn(m.log.nonJsonLine, line.slice(0, LOG_LINE_CHARS));
      return [];
    }
    switch (o.type) {
      case "system":
        if (o.subtype !== "init") return [];
        return [{ type: "ready", model: String(o.model ?? ""), mcp_ok: (o.mcp_servers ?? []).some((s: Json) => s.name === MCP_SERVER_NAME && s.status === "connected") }];
      case "stream_event": return handleStream(o.event ?? {});
      case "assistant": return handleAssistant(o.message ?? {});
      case "user": return handleUser(o.message ?? {});
      case "rate_limit_event": {
        const i = o.rate_limit_info ?? {};
        const w = i.unifiedWindows ?? {};
        return [{
          type: "limits", five_hour: w.five_hour?.utilization ?? null, seven_day: w.seven_day?.utilization ?? null,
          five_resets_at: w.five_hour?.resetsAt ?? null, seven_resets_at: w.seven_day?.resetsAt ?? null, status: String(i.status ?? ""),
        }];
      }
      case "result": return handleResult(o);
      default: return [];
    }
  }

  return { feed };
}
