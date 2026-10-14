import { z } from "zod";
import type { McpDef } from "@fullfollow/core";

const idOrName = z.union([z.number(), z.string()]);

/** The `timeline` tool: the event history of a person, opportunity or project (the last N, oldest first) */
export const mcp: McpDef = {
  tools: [{
    name: "timeline",
    description: "Kişi/fırsat/proje olay geçmişi (son N, eskiden yeniye).",
    input: { type: z.string(), id: idOrName, limit: z.number().optional() },
    run: (ctx, { type, id, limit }: { type: string; id: string | number; limit?: number }, f) => {
      const events = ctx.mod("timeline")!.forRecord(type, id, limit);
      return events.length ? events.map((e) => `${f.d(e.created_at)} ${f.who(e.created_by)} · ${e.summary}`).join("\n") : "olay yok";
    },
  }],
};
