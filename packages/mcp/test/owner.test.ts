import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { createApp } from "@fullfollow/app";
import { openDb } from "@fullfollow/core";
import { who } from "../src/format";
import { registerTools } from "../src/tools";

describe("MCP author names", () => {
  it("say Kullanıcı for the owner until a name is set, then the name, without a restart", () => {
    const handle = openDb(":memory:");
    const owner = createApp(handle, "owner");
    registerTools({ registerTool: () => undefined } as unknown as McpServer, createApp(handle, "claude"));
    expect(who("owner")).toBe("Kullanıcı");
    owner.settings.set("owner_name", "Ayşe");
    expect(who("owner")).toBe("Ayşe");
    expect(who("claude")).toBe("Claude");
  });
});
