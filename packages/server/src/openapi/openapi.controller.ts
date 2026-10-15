import { Controller, Get, Inject, Injectable, NotFoundException, OnModuleInit, Param, Res, type Type } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { createRequire } from "node:module";
import path from "node:path";
import type { Response } from "express";
import { z } from "zod";
import { docKit, type RouteDocs } from "@fullfollow/core";
import { installedModules } from "@fullfollow/app";
import { AuthController } from "../auth";
import { coreControllers } from "../controllers";
import { moduleServers } from "../modules.generated";
import { authDocs, coreDocs } from "./openapi.core";
import { buildOpenApi, type ApiInfo, type ApiSource } from "./builder";

const INFO: ApiInfo = {
  title: "Full Follow API",
  version: "0.1.0",
  description: [
    "REST API of Full Follow, a CRM for small businesses. The web app and this API share the same core services: every rule (stage moves, events, trash) lives there, never in a route.",
    "**Authentication.** When the server runs with an app password (`FF_PASSWORD`), log in with `POST /api/login` and the `ff_session` cookie authorises every other call; without a password every call is open.",
    "**Errors.** Every failure answers `{ error, code }` (see the `Error` schema). The `error` text is Turkish, meant for a person.",
    "**Lists.** `GET` on a collection takes `q`, `limit` and `offset` and answers `{ rows, total }`. Writes answer `{ row, effects }`.",
    "**Modules.** Routes are grouped by tag: one tag per installed feature module (`FF_MODULES_OFF` leaves a module's tag and routes out), plus `core`, `auth` and `docs`.",
  ].join("\n\n"),
};

const DOCS_PAGE = "/api/docs";
const ASSET_ROOT = `${DOCS_PAGE}/assets`;
/** The Swagger UI files the page loads: nothing else of the package is served */
const ASSETS = new Set(["swagger-ui.css", "swagger-ui-bundle.js", "favicon-32x32.png"]);
const ASSET_CACHE = "private, max-age=86400";

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Full Follow API</title>
<style>html{background:#fff}body{margin:0}</style>
<link rel="icon" href="${ASSET_ROOT}/favicon-32x32.png">
<link rel="stylesheet" href="${ASSET_ROOT}/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="${ASSET_ROOT}/swagger-ui-bundle.js"></script>
<script src="${DOCS_PAGE}/init.js"></script>
</body>
</html>
`;

const INIT = `window.ui = SwaggerUIBundle({
  url: "/api/openapi.json",
  dom_id: "#swagger-ui",
  deepLinking: true,
  docExpansion: "list",
  tryItOutEnabled: true,
  persistAuthorization: false,
});
`;

/** Builds the document once at startup from the controllers NestJS registered, so a route cannot be missing and a removed module's routes are gone */
@Injectable()
export class OpenApiService implements OnModuleInit {
  document: Record<string, unknown> = {};

  constructor(@Inject(DiscoveryService) private discovery: DiscoveryService) {}

  onModuleInit() {
    const controllers = this.discovery.getControllers().flatMap((w) => (w.metatype ? [w.metatype as Type<unknown>] : []));
    this.document = openApiDocument(controllers);
  }
}

@Controller("api")
export class OpenApiController {
  constructor(@Inject(OpenApiService) private service: OpenApiService) {}

  @Get("openapi.json")
  document() {
    return this.service.document;
  }

  @Get("docs")
  page(@Res() res: Response) {
    res.type("html").send(PAGE);
  }

  @Get("docs/init.js")
  init(@Res() res: Response) {
    res.type("js").send(INIT);
  }

  @Get("docs/assets/:file")
  asset(@Param("file") file: string, @Res() res: Response) {
    if (!ASSETS.has(file)) throw new NotFoundException();
    const root = path.dirname(createRequire(__filename).resolve("swagger-ui-dist/package.json"));
    res.setHeader("Cache-Control", ASSET_CACHE);
    res.sendFile(file, { root });
  }
}

const docsDocs: RouteDocs = docKit.defineDocs({
  "GET /api/openapi.json": { summary: "Get this API as an OpenAPI 3.1 document", description: "Built at startup from the registered routes of the installed modules.", response: z.looseObject({ openapi: z.string() }) },
  "GET /api/docs": { summary: "Open the Swagger UI page", contentType: "text/html" },
  "GET /api/docs/init.js": { summary: "Get the script that starts Swagger UI", contentType: "text/javascript" },
  "GET /api/docs/assets/:file": { summary: "Get a Swagger UI file (script, style, icon)", contentType: "application/octet-stream", params: { file: "swagger-ui.css, swagger-ui-bundle.js or favicon-32x32.png" } },
});

/** Every part of the API that has documentation: auth, the host's own routes, this documentation and one source per installed module */
export const apiSources: ApiSource[] = [
  { tag: "auth", description: "Login, logout and the session state", controllers: [AuthController], docs: authDocs },
  { tag: "core", description: "Server host: comments, files, links, notes, tags, sectors, sources, trash, settings, today and meta", controllers: coreControllers, docs: coreDocs },
  { tag: "docs", description: "This documentation", controllers: [OpenApiController], docs: docsDocs },
  ...moduleServers.map((m): ApiSource => ({
    tag: m.key,
    description: `Feature module ${m.key} (${installedModules.find((i) => i.key === m.key)?.label ?? m.key})`,
    controllers: m.controllers,
    docs: m.docs,
  })),
];

/** The OpenAPI document of a set of registered controllers (the server passes the ones NestJS found, the test the ones of the app module) */
export const openApiDocument = (controllers: Type<unknown>[]) => buildOpenApi(controllers, apiSources, INFO);
