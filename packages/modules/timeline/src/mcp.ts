import { z } from "zod";
import type { McpDef } from "@fullfollow/core";
import { m } from "./messages";

const idOrName = z.union([z.number(), z.string()]);

/** The `timeline` tool: the event history of a person, opportunity or project (the last N, oldest first) */
export const mcp: McpDef = {
  tools: [{
    name: "timeline",
    description: m.mcp.toolDescription,
    input: { type: z.string(), id: idOrName, limit: z.number().optional() },
    run: (ctx, { type, id, limit }: { type: string; id: string | number; limit?: number }, f) => {
      const events = ctx.mod("timeline")!.forRecord(type, id, limit);
      return events.length ? events.map((e) => `${f.d(e.created_at)} ${f.who(e.created_by)} · ${e.summary}`).join("\n") : m.mcp.noEvents;
    },
  }],
};
