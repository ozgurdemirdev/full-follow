import { z } from "zod";
import { chatAccessSettings, MCP_CHAT_SESSION_ENV, type ChatPermissionsApi, type ChatPermissionState, type McpDef } from "@fullfollow/core";
import { PERMISSION_LIMITS, PERMISSION_TOOL } from "./constants";
import { m } from "./messages";
import { decide } from "./service/permission-policy";

/** The chat session of this MCP host, or null for any host but a panel chat's (the draft runs, Claude Desktop) */
const chatSession = () => {
  const n = Number(process.env[MCP_CHAT_SESSION_ENV]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits until the owner answers a confirmation; at the deadline it expires (unless an answer won the race) */
export async function awaitAnswer(api: ChatPermissionsApi, id: number, limits: { timeoutMs: number; answerPollMs: number } = PERMISSION_LIMITS): Promise<ChatPermissionState> {
  const deadline = Date.now() + limits.timeoutMs;
  for (;;) {
    const state = api.get(id).state;
    if (state !== "pending") return state;
    const left = deadline - Date.now();
    if (left <= 0) return api.expire(id) ? "expired" : api.get(id).state;
    await sleep(Math.min(limits.answerPollMs, left));
  }
}

/**
 * The answer the Claude CLI expects from its --permission-prompt-tool, as JSON text: `{behavior:"allow", updatedInput}` (the input
 * unchanged: the CLI refuses an answer that changes the call) or `{behavior:"deny", message}`, the message Claude reads.
 */
const allow = (input: Record<string, unknown>) => JSON.stringify({ behavior: "allow", updatedInput: input });
const refuse = (message: string) => JSON.stringify({ behavior: "deny", message });

/** The confirmation tool of a panel chat's MCP host */
export const mcp: McpDef = {
  tools: [{
    name: PERMISSION_TOOL,
    description: m.permission.toolDescription,
    input: { tool_name: z.string(), input: z.record(z.string(), z.unknown()), tool_use_id: z.string().optional() },
    only: () => chatSession() !== null,
    run: async (ctx, { tool_name, input }: { tool_name: string; input: Record<string, unknown> }) => {
      try {
        const d = decide(ctx, tool_name, input, chatAccessSettings(ctx));
        if (d.kind === "allow") return allow(input);
        if (d.kind === "deny") return refuse(d.message);
        const api = ctx.mod("chat")!.permissions;
        const asked = api.ask(chatSession()!, tool_name, input, d.summary);
        const state = await awaitAnswer(api, asked.id);
        return state === "allowed" ? allow(input) : refuse(state === "expired" ? m.permission.expired : m.permission.refused);
      } catch {
        return refuse(m.permission.failed);
      }
    },
  }],
};
