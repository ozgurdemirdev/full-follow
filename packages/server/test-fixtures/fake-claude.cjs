// A stand-in for the Claude CLI in stream-json mode, for the chat tests: announces itself, then answers every user line
// with one text reply that says which environment variables it was started with, and a result line.
const readline = require("node:readline");

const SESSION = "11111111-2222-4333-8444-555555555555";
const out = (o) => process.stdout.write(`${JSON.stringify({ ...o, session_id: SESSION })}\n`);

out({ type: "system", subtype: "init", model: "claude-haiku-5-5", mcp_servers: [{ name: "full-follow", status: "connected" }] });

const WATCHED = ["FF_PASSWORD", "FF_COOKIE_SECRET", "FF_DB", "ANTHROPIC_API_KEY", "PATH", "SystemRoot"];
readline.createInterface({ input: process.stdin }).on("line", () => {
  const seen = Object.fromEntries(WATCHED.map((k) => [k, process.env[k] !== undefined]));
  out({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: JSON.stringify(seen) } } });
  out({ type: "result", subtype: "success", result: "", usage: { input_tokens: 1, output_tokens: 1 }, total_cost_usd: 0 });
});
