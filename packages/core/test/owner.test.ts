import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createCore, FFError, OWNER_NAME_MAX, openDb } from "../src";
import { MIGRATIONS_DIR } from "../src/db/client";

const clock = { now: () => "2026-10-16T10:00:00Z", today: () => "2026-10-16" };

describe("owner_name setting", () => {
  it("is empty until set, only the owner sets it, trimmed and within its length", () => {
    const db = openDb(":memory:");
    const owner = createCore(db, "owner", clock);
    const claude = createCore(db, "claude", clock);
    expect(owner.settings.view().owner_name).toBe("");
    expect(() => claude.save("setting", { owner_name: "Claude" })).toThrow(/sadece kullanıcı tarafından/);
    expect(() => owner.settings.set("owner_name", "   ")).toThrow(FFError);
    expect(() => owner.settings.set("owner_name", "x".repeat(OWNER_NAME_MAX + 1))).toThrow(FFError);
    owner.settings.set("owner_name", "  Ayşe ");
    expect(owner.settings.view().owner_name).toBe("Ayşe");
    // a refusal names the owner from now on
    expect(() => claude.save("setting", { chat_pinned_notes: "x" })).toThrow(/sadece Ayşe tarafından/);
  });
});

describe("owner_actor migration", () => {
  let dir = "";
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("moves every stored actor from ozgur to owner and keeps the rows", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-owner-"));
    // the migrations up to the one before owner_actor, applied to a file the old app wrote to
    const old = path.join(dir, "migrations");
    fs.cpSync(MIGRATIONS_DIR, old, { recursive: true });
    const journalFile = path.join(old, "meta", "_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalFile, "utf8"));
    // and none after it: the migrator skips a migration older than the last one applied
    journal.entries = journal.entries.slice(0, journal.entries.findIndex((e: { tag: string }) => e.tag.endsWith("_owner_actor")));
    fs.writeFileSync(journalFile, JSON.stringify(journal));
    const file = path.join(dir, "ff.db");
    const raw = new Database(file);
    raw.pragma("foreign_keys = OFF");
    migrate(drizzle(raw), { migrationsFolder: old });
    const t = "2026-10-01T00:00:00Z";
    raw.prepare("INSERT INTO people (created_at, updated_at, created_by, name) VALUES (?, ?, 'ozgur', 'Ada')").run(t, t);
    raw.prepare("INSERT INTO tasks (created_at, updated_at, created_by, title, assignee) VALUES (?, ?, 'ozgur', 'ara', 'ozgur')").run(t, t);
    raw.prepare("INSERT INTO tasks (created_at, updated_at, created_by, title, assignee) VALUES (?, ?, 'claude', 'yaz', 'musteri')").run(t, t);
    raw.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('weekly_target', '20', ?, 'ozgur')").run(t);
    raw.prepare("INSERT INTO events (type, summary, created_by, created_at) VALUES ('task.created', 'Görev eklendi (ozgur): ara', 'ozgur', ?)").run(t);
    raw.prepare("INSERT INTO trash (created_at, updated_at, created_by, type, record_id, label, payload) VALUES (?, ?, 'ozgur', 'task', 9, 'eski', ?)")
      .run(t, t, JSON.stringify({ tasks: [{ id: 9, created_by: "ozgur", assignee: "ozgur", title: "eski" }] }));
    const counts = () => Object.fromEntries((raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'").all() as { name: string }[])
      .map(({ name }) => [name, (raw.prepare(`SELECT COUNT(*) n FROM "${name}"`).get() as { n: number }).n]));
    const before = counts();
    raw.close();

    const handle = openDb(file);
    const q = (sql: string) => handle.sqlite.prepare(sql).all();
    expect(q("SELECT created_by, assignee FROM tasks ORDER BY id")).toEqual([{ created_by: "owner", assignee: "owner" }, { created_by: "claude", assignee: "musteri" }]);
    expect(q("SELECT created_by FROM people")).toEqual([{ created_by: "owner" }]);
    expect(q("SELECT updated_by FROM settings")).toEqual([{ updated_by: "owner" }]);
    expect(q("SELECT summary, created_by FROM events")).toEqual([{ summary: "Görev eklendi (owner): ara", created_by: "owner" }]);
    const bin = q("SELECT created_by, payload FROM trash")[0] as { created_by: string; payload: string };
    expect(bin.created_by).toBe("owner");
    expect(JSON.parse(bin.payload).tasks[0]).toMatchObject({ created_by: "owner", assignee: "owner" });
    // the tasks table is rebuilt for its new default: no row is lost anywhere
    const after = Object.fromEntries(Object.keys(before).map((name) => [name, (handle.sqlite.prepare(`SELECT COUNT(*) n FROM "${name}"`).get() as { n: number }).n]));
    expect(after).toEqual(before);
    handle.close();
  });
});
