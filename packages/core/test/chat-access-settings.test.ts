import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb } from "../src";
import { dataFolder } from "../src/services/chat-access";

// the data folder is the folder of FF_DB: a throwaway one, so the test never touches a real data folder
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "ff-data-"));
process.env.FF_DB = path.join(DATA, "data", "test.db");

const clock = { now: () => "2026-10-16T10:00:00Z", today: () => "2026-10-16" };
const owner = () => createCore(openDb(":memory:"), "owner", clock, createRegistry([]));

describe("panel chat access settings", () => {
  it("are all off until the owner turns them on", () => {
    expect(owner().settings.view()).toMatchObject({ chat_full_access: false, chat_web_fetch: false, chat_local_files: false, chat_local_folders: [] });
  });

  it("store folders as absolute paths of folders that exist, each once", () => {
    const core = owner();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-folder-"));
    core.save("setting", { chat_local_folders: [dir, `${dir}${path.sep}`, ...(process.platform === "win32" ? [dir.toUpperCase()] : [])] });
    expect(core.settings.view().chat_local_folders).toEqual([path.resolve(dir)]);
  });

  it("refuse a relative path, a missing folder, a file, and Full Follow's data folder or a folder holding it", () => {
    const core = owner();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-folder-"));
    const file = path.join(dir, "a.txt");
    fs.writeFileSync(file, "x");
    expect(() => core.save("setting", { chat_local_folders: ["Belgeler"] })).toThrow(/tam yol/);
    expect(() => core.save("setting", { chat_local_folders: [path.join(dir, "yok")] })).toThrow(/bulunamadı/);
    expect(() => core.save("setting", { chat_local_folders: [file] })).toThrow(/klasör değil/);
    fs.mkdirSync(dataFolder(), { recursive: true });
    expect(() => core.save("setting", { chat_local_folders: [dataFolder()] })).toThrow(/veri klasörü/);
    expect(() => core.save("setting", { chat_local_folders: [path.dirname(dataFolder())] })).toThrow(/veri klasörü/);
    expect(core.settings.view().chat_local_folders).toEqual([]);
  });
});
