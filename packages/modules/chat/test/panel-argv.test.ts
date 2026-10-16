import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MCP_CORE_TOOLS, type ChatAccess } from "@fullfollow/core";
import { m } from "../src/messages";
import { buildArgv, rulePath } from "../src/server/claude-cli";

process.env.FF_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ff-argv-data-")), "test.db");

const OFF: ChatAccess = { chat_full_access: false, chat_web_fetch: false, chat_local_files: false, chat_local_folders: [] };
const session = { id: 7, kind: "chat" as const, model: "claude-haiku-5-5", effort: "low", cli_session_id: "s", cli_started: false };
const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ff-argv-cwd-"));
const argvFor = (access: Partial<ChatAccess> = {}) => buildArgv(session, { access: { ...OFF, ...access }, mcpTools: [...MCP_CORE_TOOLS, "plan", "pay", "touch", "permission"], cwd });
const after = (argv: string[], flag: string) => {
  const i = argv.indexOf(flag);
  const list: string[] = [];
  for (let j = i + 1; i >= 0 && j < argv.length && !argv[j].startsWith("--"); j++) list.push(argv[j]);
  return list;
};

describe("argv of a panel chat", () => {
  it("pre-approves every Full Follow tool but delete, pay and save, and sends the rest to the confirmation tool", () => {
    const argv = argvFor();
    expect(after(argv, "--permission-prompt-tool")).toEqual(["mcp__full-follow__permission"]);
    const allowed = after(argv, "--allowedTools");
    for (const t of ["find", "get", "today", "open", "move", "plan", "touch"]) expect(allowed).toContain(`mcp__full-follow__${t}`);
    for (const t of ["delete", "pay", "save", "permission"]) expect(allowed).not.toContain(`mcp__full-follow__${t}`);
    expect(allowed).not.toContain("mcp__full-follow");
    expect(after(argv, "--mcp-config")[0]).toMatch(/mcp-chat-7\.json$/);
  });

  it("leaves WebFetch out of the tools and the allowlist while page reading is off; WebSearch stays", () => {
    const off = argvFor();
    expect(after(off, "--tools")).toEqual(["ToolSearch,WebSearch"]);
    expect(off.join(" ")).not.toMatch(/WebFetch/);
    const on = argvFor({ chat_web_fetch: true });
    expect(after(on, "--tools")).toEqual(["ToolSearch,WebSearch,WebFetch"]);
    expect(after(on, "--allowedTools")).toContain("WebFetch");
  });

  it("gives the file tools only while local files are on, scoped to the folders, and never Bash", () => {
    expect(argvFor().join(" ")).not.toMatch(/Read|Write|Edit|Glob|Grep|--add-dir|Bash/);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-argv-folder-"));
    const on = argvFor({ chat_local_files: true, chat_local_folders: [dir] });
    expect(after(on, "--tools")[0].split(",")).toEqual(["ToolSearch", "WebSearch", "Read", "Glob", "Grep", "Write", "Edit"]);
    expect(after(on, "--add-dir")).toEqual([dir]);
    // a working folder is readable without asking, so the chat's own one and the data folder are denied by rule
    expect(after(on, "--disallowedTools")).toEqual(expect.arrayContaining([`Read(${rulePath(cwd)}/**)`, `Edit(${rulePath(path.dirname(process.env.FF_DB!))}/**)`]));
    expect(on.join(" ")).not.toMatch(/Bash/);
    expect(after(on, "--allowedTools").filter((t) => /Read|Write|Edit|Glob|Grep/.test(t))).toEqual([]);
  });

  it("names folders the way the CLI's rules match them: POSIX form, // for an absolute path, /c for a Windows drive", () => {
    if (process.platform === "win32") expect(rulePath("C:\\Belgeler\\Teklifler")).toBe("//c/Belgeler/Teklifler");
    else expect(rulePath("/home/o/Teklifler")).toBe("//home/o/Teklifler");
  });
});

describe("panel rules text", () => {
  it("speaks of WebFetch only while page reading is on, and of the folders only while local files are on", () => {
    const off = m.systemRules(null);
    expect(off).not.toMatch(/WebFetch/);
    expect(off).toMatch(/WebSearch/);
    expect(off).toMatch(/ask the user to confirm/);
    expect(m.systemRules(null, { fullAccess: false, webFetch: true, folders: null })).toMatch(/WebFetch/);
    const files = m.systemRules(null, { fullAccess: true, webFetch: false, folders: ["C:\\Teklifler"] });
    expect(files).toMatch(/C:\\Teklifler/);
    expect(files).not.toMatch(/ask the user to confirm/);
  });
});
