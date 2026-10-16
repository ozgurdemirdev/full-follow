import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertUploadRoom, HttpFailure, uploadDir } from "../src";

describe("upload quota", () => {
  const before = process.env.FF_DB;
  beforeAll(() => {
    process.env.FF_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ff-quota-")), "test.db");
  });
  afterAll(() => {
    if (before === undefined) delete process.env.FF_DB;
    else process.env.FF_DB = before;
  });

  it("counts the record files and the chat uploads together and refuses an upload past the quota with a 413", () => {
    assertUploadRoom(100, 100);
    fs.mkdirSync(uploadDir("files"), { recursive: true });
    fs.writeFileSync(path.join(uploadDir("files"), "a.pdf"), Buffer.alloc(40));
    fs.mkdirSync(path.join(uploadDir("chat"), "3"), { recursive: true });
    fs.writeFileSync(path.join(uploadDir("chat"), "3", "b.txt"), Buffer.alloc(40));
    assertUploadRoom(20, 100);
    let refused: unknown;
    try {
      assertUploadRoom(21, 100);
    } catch (e) {
      refused = e;
    }
    expect(refused).toBeInstanceOf(HttpFailure);
    expect((refused as HttpFailure).status).toBe(413);
    expect((refused as HttpFailure).message).toMatch(/yükleme alanı dolu/);
  });
});
