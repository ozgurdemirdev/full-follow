import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@fullfollow/app";
import { MCP_CHAT_SESSION_ENV, MCP_CORE_TOOLS, MCP_MODE_TOOLS, openDb } from "@fullfollow/core";
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

  it("the generic tools are the ones MCP_CORE_TOOLS names (the panel chat's allowlist is built from that list)", () => {
    const moduleTools = createApp(openDb(":memory:"), "claude").modules.list().flatMap((mod) => mod.mcp?.tools?.map((t) => t.name) ?? []);
    expect(namesOf().filter((n) => !moduleTools.includes(n)).sort()).toEqual([...MCP_CORE_TOOLS].sort());
  });

  const chatInstalled = createApp(openDb(":memory:"), "claude").modules.list().some((mod) => mod.key === "chat");
  it.skipIf(!chatInstalled)("only a panel chat's host serves the confirmation tool", () => {
    expect(namesOf()).not.toContain("permission");
    process.env[MCP_CHAT_SESSION_ENV] = "3";
    try {
      expect(namesOf()).toContain("permission");
      expect(namesOf("draft")).not.toContain("permission");
    } finally {
      delete process.env[MCP_CHAT_SESSION_ENV];
    }
  });
});
