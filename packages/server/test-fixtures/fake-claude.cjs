// A stand-in for the Claude CLI in stream-json mode, for the chat tests. It never calls a model.
// A panel chat (any --mcp-config but mcp-draft.json): a plain message gets one text reply that says which environment variables it was
// started with. A message made of lines `CALL <tool> <json input>` makes tool calls the way the real CLI decides them: a built-in tool
// missing from --tools does not exist, a Full Follow tool on --allowedTools runs, a read inside the working folder or an --add-dir folder
// runs unless a --disallowedTools rule names it, and everything else goes to the --permission-prompt-tool on the MCP host, whose answer
// must follow the CLI's contract ({behavior:"allow", updatedInput?} or {behavior:"deny", message}); the reply is a JSON list of outcomes.
// A draft run (--mcp-config ...mcp-draft.json): starts the MCP host from that config like the real CLI, honours --allowedTools the way the
// real CLI does (a tool outside it is refused), tries `delete` (it must be refused twice: by the allowlist and by the host, which in mode
// "draft" does not have it), saves a draft for the record named in the request ("Kayıt: person #12"), and answers with a JSON summary.
// The request text steers it: FAIL ends with an error result, NODRAFT ends without saving. CLAUDE_FAKE_DELAY_MS slows every step (for
// watching the run in a browser); the CLAUDE_ prefix is one the server passes on.
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const SESSION = "11111111-2222-4333-8444-555555555555";
const MCP_PREFIX = "mcp__full-follow__";
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

async function connect() {
  const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
  const server = JSON.parse(fs.readFileSync(mcpConfig, "utf8")).mcpServers["full-follow"];
  const client = new Client({ name: "fake-claude", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: server.command, args: server.args, env: { ...process.env, ...server.env } }));
  return client;
}

let toolSeq = 0;
/** The tool_use block as the real CLI streams it; returns its id */
function announce(name, input) {
  const id = `toolu_${++toolSeq}`;
  out({ type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id, name, input: {} } } });
  out({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name, input }] } });
  return id;
}
const answerTool = (id, isError, content) => out({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, is_error: isError, content }] } });

/** One tool call of a draft run: refused when the allowlist does not name it */
async function callTool(client, allowed, name, args) {
  const full = `${MCP_PREFIX}${name}`;
  const id = announce(full, args);
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
  answerTool(id, result.isError, result.text);
  return result;
}

// ---- Panel chat tool calls

const IS_WIN = process.platform === "win32";
/** A path as the permission rules name it (the server's rulePath): POSIX form, /c for a drive, // for absolute */
const rulePath = (p) => {
  const r = path.resolve(p).replace(/\\/g, "/");
  const d = /^([A-Za-z]):\//.exec(r);
  const rule = d ? `//${d[1].toLowerCase()}${r.slice(2)}` : `/${r}`;
  return IS_WIN ? rule.toLowerCase() : rule;
};
const within = (child, parent) => {
  const rel = path.relative(IS_WIN ? parent.toLowerCase() : parent, IS_WIN ? child.toLowerCase() : child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};
/** `Read(//c/x/**)` style deny rules: the tool family (Read for reads, Edit for writes) and the path or its subtree */
function denied(family, target) {
  const p = rulePath(target);
  return listAfter("--disallowedTools").some((rule) => {
    const m = /^(\w+)\((.+)\)$/.exec(rule);
    if (!m || m[1] !== family) return false;
    const pattern = IS_WIN ? m[2].toLowerCase() : m[2];
    return pattern.endsWith("/**") ? p.startsWith(pattern.slice(0, -2)) : p === pattern;
  });
}
const READS = ["Read", "Glob", "Grep"];
const targetOf = (tool, input) => (tool === "Glob" || tool === "Grep" ? input.path ?? process.cwd() : input.file_path);

/** The contract of the permission prompt tool's answer; anything else is a schema-invalid answer, which the CLI treats as a refusal */
function parseDecision(textOut, input) {
  let d;
  try {
    d = JSON.parse(textOut);
  } catch {
    return { allow: false, message: "schema-invalid permission result" };
  }
  if (d?.behavior === "deny" && typeof d.message === "string") return { allow: false, message: d.message };
  if (d?.behavior !== "allow") return { allow: false, message: "schema-invalid permission result" };
  if (d.updatedInput !== undefined && (typeof d.updatedInput !== "object" || JSON.stringify(d.updatedInput) !== JSON.stringify(input))) {
    return { allow: false, message: "The permission answer changed the tool call. Nothing ran." };
  }
  return { allow: true };
}

async function runBuiltIn(tool, input) {
  const target = targetOf(tool, input);
  if (tool === "Read") return fs.readFileSync(target, "utf8");
  if (tool === "Glob" || tool === "Grep") return fs.readdirSync(target).join(",");
  if (tool === "Write") return fs.writeFileSync(target, input.content ?? ""), "written";
  if (tool === "Edit") return fs.writeFileSync(target, fs.readFileSync(target, "utf8").replace(input.old_string, input.new_string)), "edited";
  throw new Error(`no such tool ${tool}`);
}

/** One call as the CLI decides it: unavailable, ran (on the allowlist, a working folder or the prompt tool's yes) or denied */
async function panelCall(client, tool, input) {
  const builtIn = !tool.startsWith(MCP_PREFIX);
  const tools = (valueOf("--tools") ?? "").split(",");
  if (builtIn && !tools.includes(tool)) return { tool, outcome: "unavailable" };
  const id = announce(tool, input);
  await pause();
  const allowed = listAfter("--allowedTools");
  let ask = true;
  if (!builtIn) ask = !allowed.includes(tool) && !allowed.includes("mcp__full-follow");
  else {
    const target = targetOf(tool, input);
    const read = READS.includes(tool);
    if (target && denied(read ? "Read" : "Edit", target)) return answerTool(id, true, "denied by rule"), { tool, outcome: "denied", message: "rule" };
    const dirs = [process.cwd(), ...listAfter("--add-dir")];
    if (read && target && dirs.some((d) => within(path.resolve(target), path.resolve(d)))) ask = false;
  }
  if (ask) {
    const prompt = (valueOf("--permission-prompt-tool") ?? "").slice(MCP_PREFIX.length);
    const r = await client.callTool({ name: prompt, arguments: { tool_name: tool, input, tool_use_id: id } });
    const d = parseDecision((r.content ?? []).map((c) => c.text).join(""), input);
    if (!d.allow) return answerTool(id, true, d.message), { tool, outcome: "denied", message: d.message };
  }
  try {
    const result = builtIn ? await runBuiltIn(tool, input) : (await client.callTool({ name: tool.slice(MCP_PREFIX.length), arguments: input })).content.map((c) => c.text).join("\n");
    answerTool(id, false, result);
    return { tool, outcome: "ran", text: String(result).slice(0, 200) };
  } catch (e) {
    answerTool(id, true, String(e.message ?? e));
    return { tool, outcome: "failed", message: String(e.message ?? e) };
  }
}

async function panelCalls(request) {
  const calls = request.split("\n").map((l) => /^CALL (\S+) (.*)$/.exec(l.trim())).filter(Boolean);
  const client = await connect();
  try {
    const results = [];
    for (const [, name, json] of calls) {
      const tool = ["Read", "Glob", "Grep", "Write", "Edit", "Bash", "WebFetch"].includes(name) ? name : `${MCP_PREFIX}${name}`;
      results.push(await panelCall(client, tool, JSON.parse(json)));
    }
    text(JSON.stringify(results));
    done();
  } finally {
    await client.close();
  }
}

async function draftReply(request) {
  await pause();
  if (request.includes("FAIL")) return out({ type: "result", subtype: "error_during_execution", is_error: true, result: "fake failure" });
  const client = await connect();
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

const failed = (e) => out({ type: "result", subtype: "error_during_execution", is_error: true, result: String(e?.message ?? e) });
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  let request = "";
  try {
    request = (JSON.parse(line).message?.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  } catch {
    /* not a user line */
  }
  if (draftRun) return void draftReply(request).catch(failed);
  if (/^CALL /m.test(request)) return void panelCalls(request).catch(failed);
  chatReply();
});
