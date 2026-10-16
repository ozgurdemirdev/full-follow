import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "@fullfollow/app";
import { openDb, uploadDir } from "@fullfollow/core";
import { installed, startServer, type TestServer } from "./helpers";

/** An attachment row and its file, as an upload leaves them before the message is sent */
function unsentAttachment(core: ReturnType<typeof createApp>, sessionId: number, name: string) {
  const dir = path.join(uploadDir("chat"), String(sessionId));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, "x");
  const row = core.mod("chat")!.createAttachment(sessionId, { name, mime: "text/plain", size: 1, path: file });
  return { id: row.id, file };
}

describe.skipIf(!installed("chat"))("chat attachments never sent", () => {
  let server: TestServer;
  let old: { id: number; file: string };
  let fresh: { id: number; file: string };
  beforeAll(async () => {
    const handle = openDb(process.env.FF_DB!);
    const core = createApp(handle, "owner");
    const session = core.mod("chat")!.createSession();
    old = unsentAttachment(core, session.id, "old.txt");
    fresh = unsentAttachment(core, session.id, "fresh.txt");
    handle.sqlite.prepare("UPDATE chat_attachments SET created_at = ? WHERE id = ?").run("2020-01-01T00:00:00.000Z", old.id);
    handle.close();
    server = await startServer();
  });
  afterAll(() => server.close());

  it("are deleted at start, row and file, once older than the named age; a fresh one stays", async () => {
    expect(fs.existsSync(old.file)).toBe(false);
    expect(fs.existsSync(fresh.file)).toBe(true);
    expect((await server.request(`/api/chat/attachments/${old.id}`)).status).toBe(404);
    expect((await server.request(`/api/chat/attachments/${fresh.id}`)).status).toBe(200);
  });
});
