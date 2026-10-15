import "reflect-metadata";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

// The app opens the database FF_DB names when its first provider is built: a throwaway file per test file, with the chat's runtime files beside it
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ff-server-test-"));
process.env.FF_DB = path.join(dir, "test.db");
process.env.FF_BACKUP = "0";

export interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: any;
}

export interface Req {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface TestServer {
  port: number;
  /** The folder holding the database and the chat folder of this test file */
  dir: string;
  request(path: string, req?: Req): Promise<Reply>;
  close(): Promise<void>;
}

/** The whole app (module, guard, filters, body parsers) on an ephemeral port, as main.ts sets it up */
export async function startServer(): Promise<TestServer> {
  const { AppModule } = await import("../src/app.module");
  const { configureApp } = await import("../src/setup");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, bodyParser: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  const port = (app.getHttpServer().address() as { port: number }).port;

  const request = (urlPath: string, req: Req = {}) =>
    new Promise<Reply>((resolve, reject) => {
      const call = http.request({ host: "127.0.0.1", port, path: urlPath, method: req.method ?? "GET", headers: req.headers }, (res) => {
        res.on("error", () => {});
        // an event stream never ends: the reply counts once its headers are in
        if (String(res.headers["content-type"]).startsWith("text/event-stream")) {
          call.destroy();
          return resolve({ status: res.statusCode ?? 0, headers: res.headers, body: "", json: undefined });
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          let json: unknown;
          try {
            json = JSON.parse(body);
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, json });
        });
      });
      call.on("error", reject);
      call.end(req.body);
    });

  return { port, dir, request, close: () => app.close() };
}

export const JSON_HEADERS = { "content-type": "application/json" };
