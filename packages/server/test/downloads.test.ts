import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { FilesController } from "../src/controllers/files.controller";
import { filesDir } from "../src/record-files";
import "./helpers";

describe("file downloads", () => {
  it("an aborted download destroys the read stream, so the file handle is not held", async () => {
    fs.mkdirSync(filesDir(), { recursive: true });
    fs.writeFileSync(path.join(filesDir(), "big.pdf"), Buffer.alloc(1024 * 1024));
    const core = { files: { get: () => ({ mime: "application/pdf", name: "big.pdf", stored_name: "big.pdf" }) } };
    // a response that never drains: the file stream stays open until the response closes
    const res = Object.assign(new Writable({ write() {} }), { setHeader() {} });
    const open = vi.spyOn(fs, "createReadStream");
    try {
      new FilesController(core as never).download("1", res as never);
      const stream = open.mock.results[0].value as fs.ReadStream;
      expect(stream.destroyed).toBe(false);
      res.destroy();
      await new Promise((done) => setImmediate(done));
      expect(stream.destroyed).toBe(true);
    } finally {
      open.mockRestore();
    }
  });
});
