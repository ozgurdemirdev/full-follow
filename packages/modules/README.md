# Feature modules

One folder per feature, one npm workspace package each (`@fullfollow/mod-<key>`). Removing the folder (or setting
`FF_MODULES_OFF=<key>`) takes the feature out of the build, the server, MCP and the tests, and nothing else needs an edit.
The plan is `docs/plan-moduler.md`; `calendar` is the reference module, copy its shape.

## Layout

```
packages/modules/<key>/
  package.json     name "@fullfollow/mod-<key>", "fullfollow": { "module": "<key>" }, main/types to dist,
                   "exports": { ".": core part, "./server": Nest part } (+ typesVersions for "./server"),
                   dependencies: @fullfollow/core (workspace), drizzle-orm, zod; peer: @nestjs/common
  tsconfig.json    composite, extends the base, references ../../core, decorators on
  vitest.config.ts aliases @fullfollow/core to core's sources
  src/index.ts     default export defineModule({ key, label, uses, api, entities, hooks, contribute, mcp })
  src/api.ts       implements the contract from core/src/contracts/<key>.ts
  src/entities.ts  the record types it owns (save, find, get, delete, aliases, name ref)
  src/service/*    services, Zod schemas, constants
  src/server/index.ts  exports `controllers` (NestJS); they inject the app with APP_TOKEN, never the server package
  src/mcp.ts       MCP output of its records, its own tools, its fragments of the generic tool descriptions
  test/*.test.ts   Vitest, in-memory SQLite, `createCore(..., createRegistry([module]))`
```

## Rules

- A module imports only `@fullfollow/core` (`npm run check:boundaries` fails the build otherwise). Core exports what a service needs:
  `writeEvent`, `parse`, `row(s)`, `stamp`, `Bin`, `requireRow`, `schema` (every Drizzle table), `zodKit`, the contracts, `APP_TOKEN`, `intId`, `listOpts`, `withList`.
- Tables stay in core's Drizzle schema. A module owns its tables by convention; removing it never touches data and `db:generate` must produce nothing.
- The contract (`core/src/contracts/<key>.ts`, types only) is registered in `ModuleApis`. Anyone else reaches the module with
  `ctx.mod("<key>")?.…` and handles `undefined`. Cross-module rules are hooks on events, run in the transaction of the emitter.
- A module plugs into the shared parts through `defineModule`:
  - `entities`: record types for the generic `save` / `find` / `get` / `delete` / `restore`; `aliases`, `ref` (name lookup, `<type>` input key), `related`.
  - `contribute`: `trashTypes`, `recordLabels`, `today` sections, `relations` (what `get(..., with)` can load on other types), `meta` (for `/api/meta`).
  - `mcp`: `entities` (line, details, kind, openable), `tools`, `docs` (fragments sorted by `at`, core's are 100, 200, ...), `today` sections, `relations`.
- Anything the module still needs from a feature that is not a module yet is marked `// TODO(modules): via ctx.mod("<future module>")`.

## Wiring

`scripts/gen-modules.mjs` scans this folder and writes `packages/app/src/modules.generated.ts` and `packages/server/src/modules.generated.ts`.
`scripts/build.mjs` builds core, every module, app, server and MCP in that order; `scripts/test.mjs` runs core, app and every module's tests.
Both run from `npm run build` / `npm test` / `npm start`. `GET /api/modules` lists the installed modules.
