import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@fullfollow/app";
import { openDb } from "@fullfollow/core";
import { FIND_LIMIT_MAX } from "../src/constants";
import { registerTools } from "../src/tools";

/** The tools registerTools adds, by name, so a test can call a handler the way the SDK would */
function toolsOf(core: ReturnType<typeof createApp>) {
  const handlers = new Map<string, (input: any) => { content: { text: string }[] }>();
  registerTools({ registerTool: (name: string, _config: unknown, handler: (input: any) => any) => void handlers.set(name, handler) } as unknown as McpServer, core);
  return handlers;
}

describe("MCP find", () => {
  it("asks the core for at most FIND_LIMIT_MAX rows, whatever limit the call gives", () => {
    const core = createApp(openDb(":memory:"), "claude");
    const asked: (number | undefined)[] = [];
    const find = core.find.bind(core);
    core.find = ((type: string, opts: { limit?: number }) => (asked.push(opts.limit), find(type, opts))) as typeof core.find;
    const tools = toolsOf(core);
    tools.get("find")!({ type: "tag", limit: 100_000 });
    tools.get("find")!({ type: "tag", limit: 5 });
    tools.get("find")!({ type: "tag" });
    expect(asked).toEqual([FIND_LIMIT_MAX, 5, undefined]);
  });
});
