import "reflect-metadata";
import { RequestMethod, type Type } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { z, type ZodType } from "zod";
import type { HttpMethod, RouteDoc, RouteDocs } from "@fullfollow/core";

/** The controllers of one part of the app (a module, the core controllers, auth) and the documentation of their routes */
export interface ApiSource {
  tag: string;
  description: string;
  controllers: Type<unknown>[];
  docs: RouteDocs;
}

export interface Route {
  method: HttpMethod;
  /** As the controllers declare it, path parameters with a colon: /api/tasks/:id */
  path: string;
  source: ApiSource | undefined;
  controller: Type<unknown>;
  status: number | undefined;
}

export interface ApiInfo {
  title: string;
  version: string;
  description: string;
}

const METHODS: Partial<Record<number, HttpMethod>> = {
  [RequestMethod.GET]: "GET",
  [RequestMethod.POST]: "POST",
  [RequestMethod.PUT]: "PUT",
  [RequestMethod.PATCH]: "PATCH",
  [RequestMethod.DELETE]: "DELETE",
};

const join = (...parts: string[]) => "/" + parts.map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
const asText = (v: unknown): string => (Array.isArray(v) ? String(v[0] ?? "") : String(v ?? ""));

/** The routes NestJS has registered for these controllers, in declaration order (from the decorators' metadata, the same data the router is built from) */
export function routesOf(controllers: Type<unknown>[], sources: ApiSource[]): Route[] {
  const out: Route[] = [];
  for (const controller of controllers) {
    const base = asText(Reflect.getMetadata(PATH_METADATA, controller));
    const proto = controller.prototype as object;
    for (const name of Object.getOwnPropertyNames(proto)) {
      // the descriptor's value: reading a getter of the controller would run it
      const handler: unknown = Object.getOwnPropertyDescriptor(proto, name)?.value;
      if (typeof handler !== "function") continue;
      const code = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (code === undefined) continue;
      const method = METHODS[code];
      if (!method) throw new Error(`${controller.name}.${name}: request method ${RequestMethod[code]} cannot be documented`);
      out.push({
        method,
        path: join(base, asText(Reflect.getMetadata(PATH_METADATA, handler))),
        source: sources.find((s) => s.controllers.includes(controller)),
        controller,
        status: Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined,
      });
    }
  }
  return out;
}

/** The documentation entry of a route (undefined when its module did not write one) */
export const docOf = (r: Route): RouteDoc | undefined => r.source?.docs[`${r.method} ${r.path}` as keyof RouteDocs];

type Json = Record<string, unknown>;

/** Zod writes the safe integer range into every integer; it only adds noise to the documentation */
const SAFE_INTEGER_BOUNDS: Record<string, number> = { maximum: Number.MAX_SAFE_INTEGER, minimum: Number.MIN_SAFE_INTEGER };

function withoutIntegerBounds(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutIntegerBounds);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node).filter(([k, v]) => SAFE_INTEGER_BOUNDS[k] !== v).map(([k, v]) => [k, withoutIntegerBounds(v)]),
  );
}

function schemaOf(s: ZodType, io: "input" | "output"): Json {
  const { $schema: _drop, ...schema } = z.toJSONSchema(s, { io, unrepresentable: "any", target: "draft-2020-12" }) as Json;
  return withoutIntegerBounds(schema) as Json;
}

const pathParams = (path: string): string[] => [...path.matchAll(/:(\w+)/g)].map((m) => m[1]);
const openApiPath = (path: string) => path.replace(/:(\w+)/g, "{$1}");

function queryParameters(query: ZodType): Json[] {
  const { properties = {}, required = [] } = schemaOf(query, "input") as { properties?: Record<string, Json>; required?: string[] };
  return Object.entries(properties).map(([name, { description, ...schema }]) => ({
    name, in: "query", required: required.includes(name), ...(description ? { description } : {}), schema,
  }));
}

function operation(r: Route, doc: RouteDoc | undefined): Json {
  const tag = r.source?.tag ?? "other";
  const params: Json[] = pathParams(r.path).map((name) => ({
    name, in: "path", required: true,
    ...(doc?.params?.[name] ? { description: doc.params[name] } : {}),
    schema: /id$/i.test(name) ? { type: "integer", minimum: 1 } : { type: "string" },
  }));
  if (doc?.query) params.push(...queryParameters(doc.query));

  const status = doc?.status ?? r.status ?? (r.method === "POST" ? 201 : 200);
  const success: Json = { description: "Success" };
  if (doc?.contentType) success.content = { [doc.contentType]: { schema: doc.contentType === "text/event-stream" ? { type: "string" } : { type: "string", format: "binary" } } };
  else if (doc?.response) success.content = { "application/json": { schema: schemaOf(doc.response, "output") } };

  const op: Json = {
    operationId: `${r.method.toLowerCase()}${r.path.replace(/[^A-Za-z0-9]+(\w)/g, (_, c: string) => c.toUpperCase())}`,
    summary: doc?.summary ?? `${r.method} ${r.path}`,
    tags: [tag],
    ...(doc?.description ? { description: doc.description } : {}),
    ...(params.length ? { parameters: params } : {}),
    responses: {
      [status]: success,
      ...(doc?.public ? {} : { 401: { $ref: "#/components/responses/Unauthorized" } }),
      default: { $ref: "#/components/responses/Error" },
    },
  };
  if (doc?.body) op.requestBody = { required: true, content: { "application/json": { schema: schemaOf(doc.body, "input") } } };
  if (doc?.multipart) op.requestBody = { required: true, content: { "multipart/form-data": { schema: schemaOf(doc.multipart, "input") } } };
  if (doc?.public) op.security = [];
  return op;
}

const COMPONENTS: Json = {
  securitySchemes: {
    session: {
      type: "apiKey", in: "cookie", name: "ff_session",
      description: "Session cookie set by POST /api/login with the app password (FF_PASSWORD). When no password is configured the server accepts every request.",
    },
  },
  schemas: {
    Error: {
      type: "object",
      required: ["error", "code"],
      properties: {
        error: { type: "string", description: "What went wrong, in a sentence a person can read (Turkish)" },
        code: { type: "string", description: "validation, not_found, rule, ambiguous, forbidden, duplicate, http (a malformed request: wrong id, number or body type, oversized body, foreign Host), attachment (an upload the chat refuses), file (a record file upload refused or missing), busy, too_many_runs, cli_missing (chat) or internal" },
        candidates: { type: "array", items: {}, description: "Code ambiguous: the records the name could mean" },
        duplicate: { type: "object", additionalProperties: {}, description: "Code duplicate: the record that already exists" },
      },
    },
  },
  responses: {
    Error: {
      description: "The shared error shape. validation answers 400; http answers 400, or 413 for a body over the size limit, 415 for a data changing request that is not application/json or multipart/form-data, 421 for a Host that is not this computer; not_found and a missing file 404; rule, ambiguous, duplicate and busy 409; forbidden 403; too_many_runs 429; cli_missing 503; an upload refused as too big 413; anything else 500.",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
    Unauthorized: {
      description: "No valid session cookie: log in with POST /api/login",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    },
  },
};

/** The OpenAPI 3.1 document of the registered controllers; a route without an entry in its module's docs is still listed, by its method and path */
export function buildOpenApi(controllers: Type<unknown>[], sources: ApiSource[], info: ApiInfo): Json {
  const paths: Record<string, Json> = {};
  for (const r of routesOf(controllers, sources)) {
    (paths[openApiPath(r.path)] ??= {})[r.method.toLowerCase()] = operation(r, docOf(r));
  }
  const used = new Set(controllers.map((c) => sources.find((s) => s.controllers.includes(c))?.tag));
  return {
    openapi: "3.1.0",
    info,
    servers: [{ url: "/" }],
    security: [{ session: [] }],
    tags: sources.filter((s) => used.has(s.tag)).map((s) => ({ name: s.tag, description: s.description })),
    paths,
    components: COMPONENTS,
  };
}
