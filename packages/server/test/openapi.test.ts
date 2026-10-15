import "reflect-metadata";
import type { Type } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { moduleServers } from "../src/modules.generated";
import { docOf, routesOf } from "../src/openapi/builder";
import { apiSources, openApiDocument } from "../src/openapi/openapi.controller";

/** The controllers the app module registers: what NestJS serves */
const controllers = Reflect.getMetadata("controllers", AppModule) as Type<unknown>[];
const routes = routesOf(controllers, apiSources);
const label = (r: { method: string; path: string }) => `${r.method} ${r.path}`;

describe("API documentation", () => {
  it("every registered controller belongs to a documented source", () => {
    expect(routes.filter((r) => !r.source).map(label)).toEqual([]);
  });

  it("every registered route has a summary (add it to the module's src/server/openapi.ts)", () => {
    expect(routes.filter((r) => !docOf(r)?.summary).map(label)).toEqual([]);
  });

  it("every documented route exists (a renamed or removed route leaves no stale entry)", () => {
    const real = new Set(routes.map(label));
    const stale = apiSources.flatMap((s) => Object.keys(s.docs).filter((k) => s.controllers.some((c) => controllers.includes(c)) && !real.has(k)));
    expect(stale).toEqual([]);
  });

  it("the document is valid JSON with a tag per installed module", () => {
    const doc = JSON.parse(JSON.stringify(openApiDocument(controllers))) as {
      openapi: string;
      tags: { name: string }[];
      paths: Record<string, Record<string, { operationId: string; tags: string[]; parameters?: { name: string; in: string }[] }>>;
    };
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.tags.map((t) => t.name).sort()).toEqual(["auth", "core", "docs", ...moduleServers.map((m) => m.key)].sort());

    const ops = Object.entries(doc.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, op]) => ({ path, method, ...op })));
    expect(ops.length).toBe(routes.length);
    expect(new Set(ops.map((o) => o.operationId)).size).toBe(ops.length);
    for (const op of ops) {
      const declared = (op.parameters ?? []).filter((p) => p.in === "path").map((p) => p.name).sort();
      expect(declared, `${op.method} ${op.path}`).toEqual([...op.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort());
    }
  });

  it("request bodies and query strings come from the module's Zod schemas", () => {
    const doc = openApiDocument(controllers) as { paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: { properties?: object } }> }; parameters?: { name: string }[] }>> };
    const create = doc.paths["/api/links"].post.requestBody?.content["application/json"].schema;
    expect(Object.keys(create?.properties ?? {})).toContain("label");
    expect((doc.paths["/api/tags"].get.parameters ?? []).map((p) => p.name)).toEqual(expect.arrayContaining(["q", "limit", "offset", "all"]));
  });
});
