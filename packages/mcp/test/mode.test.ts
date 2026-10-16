import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@fullfollow/app";
import { MCP_MODE_TOOLS, openDb } from "@fullfollow/core";
import { registerTools } from "../src/tools";

const namesOf = (mode?: "draft") => {
  const names: string[] = [];
  registerTools({ registerTool: (name: string) => void names.push(name) } as unknown as McpServer, createApp(openDb(":memory:"), "claude"), mode);
  return names.sort();
};

describe("MCP mode", () => {
  it("draft registers only the read tools and draft: delete, save, move, pay and the rest do not exist", () => {
    const all = namesOf();
    const draft = namesOf("draft");
    expect(draft).toEqual(all.filter((n) => (MCP_MODE_TOOLS.draft as readonly string[]).includes(n)));
    for (const forbidden of ["delete", "save", "move", "pay", "today", "touch", "open"]) expect(draft).not.toContain(forbidden);
  });
});
