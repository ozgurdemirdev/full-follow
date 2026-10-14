#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp } from "@fullfollow/app";
import { defaultDbPath, loadRootEnv, openDb } from "@fullfollow/core";
import { registerTools } from "./tools";

/**
 * Full Follow MCP sunucusu (stdio). Özgür'ün bilgisayarında Claude Desktop / Claude Code başlatır.
 * Aynı SQLite dosyasını (WAL) web sunucusuyla birlikte açar; her işlem actor = "claude" olarak kaydedilir.
 * stdout protokole ayrılmıştır; günlükler stderr'e yazılır.
 */
async function main() {
  loadRootEnv();
  const dbPath = defaultDbPath();
  const handle = openDb(dbPath);
  const core = createApp(handle, "claude");

  const server = new McpServer({ name: "full-follow", version: "0.1.0" });
  registerTools(server, core);

  process.on("SIGINT", () => { handle.close(); process.exit(0); });
  process.on("SIGTERM", () => { handle.close(); process.exit(0); });

  await server.connect(new StdioServerTransport());
  console.error(`full-follow mcp hazır (${dbPath})`);
}

main().catch((e) => {
  console.error("full-follow mcp başlatılamadı:", e);
  process.exit(1);
});
