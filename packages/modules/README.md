# Feature modules

One folder per feature, one npm workspace package each (`@fullfollow/mod-<key>`). Removing the folder (or setting
`FF_MODULES_OFF=<key>`) takes the feature out of the build, the server, MCP and the tests, and nothing else needs an edit.
The plan is `docs/plan-moduler.md`; `calendar` is the reference module, copy its shape; `people`, `companies` and `network` show a group of modules that use each other, `pipeline` and `projects` show a rule that crosses two modules as an event (a won opportunity opens its project), and `drafts`, `templates`, `ideas`, `own-projects` and `referrals` show hooks that run in an order (the send warnings, the interest of an idea, the trash cleanup) and modules whose table is read by others. `reports` (reads every number through `ctx.mod`, adds the price floor to the settings view), `timeline` (reads the `events` table; the other modules list the events they write with `timelineKinds`) and `chat` (the Claude runner as Nest providers, `softTrash`) are the last three.

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
  src/server/index.ts  exports `controllers` (NestJS) and optionally `providers` (services that start and stop with the server); they inject the app with APP_TOKEN, never the server package
  src/mcp.ts       MCP output of its records, its own tools, its fragments of the generic tool descriptions
  test/*.test.ts   Vitest, in-memory SQLite, `createCore(..., createRegistry([module]))`
```

## Rules

- A module imports only `@fullfollow/core` (`npm run check:boundaries` fails the build otherwise). Core exports what a service needs:
  `writeEvent`, `parse`, `row(s)`, `keptRow(s)` (the same for a literal SQL text: the statement is prepared once per connection, for reads on hot paths), `stamp`, `Bin`, `announceTrashed`, `requireRow`, `resolveRef`, `schema` (every Drizzle table), `zodKit`, the contracts, `APP_TOKEN`, `intId`, `listOpts`, `withList`,
  `placeInGroup`, `renumberGroup`, `addTagBySlug`, `readTemplate`, `filesOf`, `requireTarget` (the row a file, link or comment hangs on), `assertOzgur`,
  and the shared helpers of the features that are not modules (tags and sectors, `sectorMatch`, `sectorInput`, duplicate keys, the recipient helpers `resolveSubject`, `renderTemplate`, `REPLIED_AFTER`, `isColdEmail`, `marketingSettings`, `queriesFor`).
- Tables stay in core's Drizzle schema. A module owns its tables by convention; removing it never touches data and `db:generate` must produce nothing.
  Reading another module's table directly (an aggregate that joins it: the template statistics over the drafts and touches tables) is fine for a read that must keep working without that module, because every table always exists; writing it, or enforcing its rules, goes through `ctx.mod`.
- The contract (`core/src/contracts/<key>.ts`, types only) is registered in `ModuleApis`. Anyone else reaches the module with
  `ctx.mod("<key>")?.…` and handles `undefined`. Cross-module rules are hooks on events, run in the transaction of the emitter
  (`ctx.emit(name, payload)` returns the effect strings of the hooks; a throwing hook rolls everything back). Events so far:
  `touch.created`, `touch.updated` (network; drafts add the send warnings, ideas link the person to the idea, pipeline advances the stage), `opportunity.won` (pipeline emits it inside the move to won, the payload carries the opportunity, the accepted offer and the price as plain data;
  projects hooks it and opens the project with its payments, a hook's effect strings join the move's effects), `record.trashed` (before a record's row is taken: a module takes or unlinks what points at it through the `bin`;
  restoring puts it back from the same trash row) and `record.restored`.
  Hooks of one event run in module key order (the order of the effect strings: drafts, ideas, ..., pipeline); `hookOrder: { "record.trashed": 10 }` moves a module's hook after the others of that event, per event. A hook that takes rows another module's rows point at must run after that module's (the drafts are taken after the network module took the touches that carry `draft_id`; the interest rows before the touches they point at, by key order).
- A module plugs into the shared parts through `defineModule`:
  - `entities`: record types for the generic `save` / `find` / `get` / `delete` / `move` / `restore`; `aliases`, `ref` (name lookup, `<type>` input key), `refKeys` (more input keys, `referred_by`),
    `related`, `prepare` (rewrites the input of `save`), `bulk` (duplicate keys of a list save).
  - `contribute`: `trashTypes`, `recordLabels`, `today` sections (a section is a record or a plain value under its own key), `relations` (what `get(..., with)` can load on other types; `load(ctx, by, limit, row)`; one name can be served by several modules for different types), `meta` (for `/api/meta`),
    `commentTargets` (record types comments hang on; `links` / `files` allow labelled links / uploaded files on the type, `linksFrom` adds another record's links to its list), `chatCards` (what a record chip of the panel chat shows),
    `timelineKinds` (event type to the kind it has in the timeline feed: `{ kind, amount?, row? }`, so the timeline module never names an event), `settingsView` (figures computed from the settings, added to `GET /api/settings`), `sourceCounts` (extra count columns of the sources list), `softTrash` (records hidden in place by a `deleted_at` column: the trash lists and restores them),
    `recordLinks` (what a project or an opportunity leads to: `link()` fills an event's opportunity and person from it), `jobs` (scheduled work for the server host: `{ name, everyMs, firstRunMs?, enabled?, run(app) }`; `app` acts as Claude, a job never overlaps itself, the host stops them on shutdown).
  - `mcp`: `entities` (line, details, kind, openable), `tools` (a tool's `description` is a text or fragments that the other modules' `docs` for that tool continue), `skip` (row fields `get` does not repeat), `docs` (fragments sorted by `at`, core's are 100, 200, ...), `today` sections (`head: true` puts the text before the sections, after the week line), `marketing` lines, `relations` (relation name to the record type its rows are written as; `"people:idea"` names the type for one record type), `relationLines` (a relation whose rows are not records writes its own line), `todayData` (data the `today` tool adds to the view before the text is written: the follow-up drafts).
  - `hookOrder`: see events above.
  - `smoke`: GET paths without parameters that must answer 200 while the module is installed; `npm run check:modules` requests them. Fill it for every new module.
- A read of another module's table (counts, joins, a foreign key check) is written as such with a comment saying so; it is the intended way when the read must keep working without that module. Everything that writes, or enforces a rule of, another module goes through `ctx.mod`.

## Wiring

`scripts/gen-modules.mjs` scans this folder and writes `packages/app/src/modules.generated.ts` and `packages/server/src/modules.generated.ts`.
`scripts/build.mjs` builds core, every module, app, server and MCP in that order; `scripts/test.mjs` runs core, app and every module's tests.
Both run from `npm run build` / `npm test` / `npm start`. `npm run check:modules` is the removal check: for each module and for all off, it regenerates the lists, builds, tests, builds the web, starts the server and the MCP host against a seeded copy of the demo database and requests the core and `smoke` endpoints; run it at the end of a phase and before a merge (it takes about half an hour; take the build lock once around it if others build). `GET /api/modules` lists the installed modules.
The server gives a module's controller two apps through string tokens: `APP_TOKEN` (actor `ozgur`) and `CLAUDE_APP_TOKEN` (the same app as `claude`, for what Claude writes when the panel asks for it: the follow-up drafts).
