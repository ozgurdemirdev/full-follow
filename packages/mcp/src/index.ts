#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp } from "@fullfollow/app";
import { defaultDbPath, loadRootEnv, MCP_MODE_ENV, MCP_MODE_TOOLS, openDb, type McpMode } from "@fullfollow/core";
import { m } from "./messages";
import { registerTools } from "./tools";

/**
 * Full Follow MCP sunucusu (stdio). Özgür'ün bilgisayarında Claude Desktop / Claude Code başlatır.
 * Aynı SQLite dosyasını (WAL) web sunucusuyla birlikte açar; her işlem actor = "claude" olarak kaydedilir.
 * stdout protokole ayrılmıştır; günlükler stderr'e yazılır.
 */
async function main() {
  loadRootEnv();
  // a mode limits the tools (the draft runs of the panel); an unknown one stops here instead of starting with every tool
  const mode = process.env[MCP_MODE_ENV] || undefined;
  if (mode !== undefined && !Object.hasOwn(MCP_MODE_TOOLS, mode)) throw new Error(m.unknownMode(mode, Object.keys(MCP_MODE_TOOLS).join(", ")));
  const dbPath = defaultDbPath();
  const handle = openDb(dbPath);
  const core = createApp(handle, "claude");

  const server = new McpServer({ name: "full-follow", version: "0.1.0" });
  registerTools(server, core, mode as McpMode | undefined);

  process.on("SIGINT", () => { handle.close(); process.exit(0); });
  process.on("SIGTERM", () => { handle.close(); process.exit(0); });

  await server.connect(new StdioServerTransport());
  console.error(m.ready(dbPath));
}

main().catch((e) => {
  console.error(m.startFailed, e);
  process.exit(1);
});
