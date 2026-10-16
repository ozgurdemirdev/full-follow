// A stand-in for the Claude CLI in stream-json mode, for the chat tests. A panel chat (any --mcp-config but mcp-draft.json): answers every
// user line with one text reply that says which environment variables it was started with, and a result line.
// A draft run (--mcp-config ...mcp-draft.json): starts the MCP host from that config like the real CLI, honours --allowedTools the way the
// real CLI does (a tool outside it is refused), tries `delete` (it must be refused twice: by the allowlist and by the host, which in mode
// "draft" does not have it), saves a draft for the record named in the request ("Kayıt: person #12"), and answers with a JSON summary.
// The request text steers it: FAIL ends with an error result, NODRAFT ends without saving. CLAUDE_FAKE_DELAY_MS slows every step (for
// watching the run in a browser); the CLAUDE_ prefix is one the server passes on.
const fs = require("node:fs");
const readline = require("node:readline");

const SESSION = "11111111-2222-4333-8444-555555555555";
const out = (o) => process.stdout.write(`${JSON.stringify({ ...o, session_id: SESSION })}\n`);
const argv = process.argv.slice(2);
const valueOf = (name) => {
  const i = argv.indexOf(name);
  return i < 0 ? null : argv[i + 1];
};
const listAfter = (name) => {
  const i = argv.indexOf(name);
  const list = [];
  for (let j = i + 1; i >= 0 && j < argv.length && !argv[j].startsWith("--"); j++) list.push(argv[j]);
  return list;
};
const mcpConfig = valueOf("--mcp-config") ?? "";
const draftRun = mcpConfig.endsWith("mcp-draft.json");
const delay = Number(process.env.CLAUDE_FAKE_DELAY_MS ?? 0);
const pause = () => new Promise((r) => setTimeout(r, delay));
const text = (t) => out({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } } });
const done = () => out({ type: "result", subtype: "success", result: "", usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0 });

out({ type: "system", subtype: "init", model: "claude-haiku-5-5", mcp_servers: [{ name: "full-follow", status: "connected" }] });

const WATCHED = ["FF_PASSWORD", "FF_COOKIE_SECRET", "FF_DB", "ANTHROPIC_API_KEY", "PATH", "SystemRoot"];
function chatReply() {
  const seen = Object.fromEntries(WATCHED.map((k) => [k, process.env[k] !== undefined]));
  text(JSON.stringify(seen));
  done();
}

let toolSeq = 0;
/** One tool call as the real CLI streams it: the tool_use block, then its result; refused when the allowlist does not name it */
async function callTool(client, allowed, name, args) {
  const id = `toolu_${++toolSeq}`;
  const full = `mcp__full-follow__${name}`;
  out({ type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id, name: full, input: {} } } });
  out({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name: full, input: args }] } });
  await pause();
  let result;
  if (!allowed.includes(full)) result = { refused: "cli", isError: true, text: `Permission to use ${full} has been denied.` };
  else {
    try {
      const r = await client.callTool({ name, arguments: args });
      result = { isError: !!r.isError, text: (r.content ?? []).map((c) => c.text).join("\n") };
    } catch (e) {
      result = { refused: "mcp", isError: true, text: String(e.message ?? e) };
    }
  }
  out({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, is_error: result.isError, content: result.text }] } });
  return result;
}

async function draftReply(request) {
  await pause();
  if (request.includes("FAIL")) return out({ type: "result", subtype: "error_during_execution", is_error: true, result: "fake failure" });
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
  const server = JSON.parse(fs.readFileSync(mcpConfig, "utf8")).mcpServers["full-follow"];
  const client = new Client({ name: "fake-claude", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: server.command, args: server.args, env: { ...process.env, ...server.env } }));
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    const allowed = listAfter("--allowedTools");
    const rec = /Kayıt: (person|company) #(\d+)/.exec(request);
    const target = rec ? { [rec[1]]: Number(rec[2]) } : { contact: "fake@example.com" };
    const viaCli = await callTool(client, allowed, "delete", { type: "draft", id: 1 });
    // the host itself, asked directly as if the allowlist had let it through
    let viaMcp;
    try {
      const r = await client.callTool({ name: "delete", arguments: { type: "draft", id: 1 } });
      viaMcp = r.isError ? "refused" : "allowed";
    } catch {
      viaMcp = "refused";
    }
    const read = rec ? await callTool(client, allowed, "get", { type: rec[1], id: Number(rec[2]) }) : null;
    const saved = request.includes("NODRAFT") ? null : await callTool(client, allowed, "draft", { ...target, channel: "whatsapp", body: "Merhaba, nasılsın? (fake taslak)", why: "fake" });
    await pause();
    text(JSON.stringify({ tools, deleteViaCli: viaCli.refused ?? "allowed", deleteViaMcp: viaMcp, readOk: read ? !read.isError : null, saved: saved ? !saved.isError : null }));
    done();
  } finally {
    await client.close();
  }
}

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!draftRun) return chatReply();
  let request = "";
  try {
    request = (JSON.parse(line).message?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch {
    /* not a user line */
  }
  draftReply(request).catch((e) => out({ type: "result", subtype: "error_during_execution", is_error: true, result: String(e?.message ?? e) }));
});
