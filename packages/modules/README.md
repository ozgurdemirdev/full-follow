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

## API docs

`GET /api/docs` (Swagger UI, served offline from `swagger-ui-dist`) and `GET /api/openapi.json` (OpenAPI 3.1) describe every route, grouped by tag (one tag per installed module, plus `core`, `auth`, `docs`). Both sit behind the same session as the rest of `/api`. The route list comes from NestJS (the controllers the app registered), so a removed module's routes and tag disappear with it; the request shapes come from your own Zod schemas through `z.toJSONSchema`, so they cannot drift from what the service accepts.

A module documents its routes in `src/server/openapi.ts`, a map from `"METHOD /api/path/:id"` to a `RouteDoc`, and exports it from `src/server/index.ts` next to `controllers` (`export { docs } from "./openapi"`). The controllers stay untouched. `calendar` is the reference.

```ts
import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { taskCreate, taskQuick, taskUpdate } from "../service/schemas";

const { crud, defineDocs, flag, object, saveResult } = docKit;

export const docs = defineDocs({
  // list, read one, create, patch and delete of a record type in one call
  ...crud("/api/tasks", { noun: "task", filters: { done: flag("Only done tasks") }, create: taskCreate, update: taskUpdate }),
  "POST /api/tasks/quick": { summary: "Create a task from one line of text", description: "...", body: taskQuick, response: saveResult },
  "GET /api/plan": { summary: "Get the plan of a day", query: z.object({ date: z.string().optional() }), response: object },
});
```

`RouteDoc` fields: `summary` (required, one short English sentence), `description`, `query` (a Zod object, one property per parameter), `body` (JSON), `multipart` (an upload), `response`, `status` (when it is not 201 for POST and 200 otherwise), `contentType` (a download or an event stream), `params` (descriptions of path parameters; a name ending in `id` is an integer), `public` (no session needed). Shared shapes live in `docKit`: `listQuery`, `listOf`, `saveResult`, `row`, `object`, `flag`, `directoryFilters`. Rows are documented as free objects with an `id`; give a route its own Zod object when you want the row fields shown.

`npm test` (the server package) fails when a registered route has no summary, when an entry names a route that no longer exists, or when a controller is not part of any documented source: a new route cannot ship undocumented. `npm run check:modules` also requests `/api/openapi.json` and checks that an off module's tag is gone.

## Wiring

`scripts/gen-modules.mjs` scans this folder and writes `packages/app/src/modules.generated.ts`, `packages/server/src/modules.generated.ts` and, for the web part (below), `packages/web/src/modules.generated.ts` and `packages/web/src/styles/modules.generated.css`.
`scripts/build.mjs` builds core, every module, app, server and MCP in that order; `scripts/test.mjs` runs the tests of core, app, server and every module.
Both run from `npm run build` / `npm test` / `npm start`. `npm run check:modules` is the removal check: for each module and for all off, it regenerates the lists, compiles every package, runs the remaining tests, starts the server and the MCP host against a seeded copy of the demo database and requests the core and `smoke` endpoints (the web is typechecked once, all on, and built again for every case with the generated web list of that case; the build must hold the `fullfollow.webMarkers` of exactly the installed modules); run it at the end of a phase and before a merge (take the build lock once around it if others build). `GET /api/modules` lists the installed modules.
The server gives a module's controller two apps through string tokens: `APP_TOKEN` (actor `ozgur`) and `CLAUDE_APP_TOKEN` (the same app as `claude`, for what Claude writes when the panel asks for it: the follow-up drafts).

## Web part

A module's screens live in `packages/modules/<key>/web/`; `packages/web` keeps the shell and the kit. Every module has a `web/index.ts` that exports `default defineWebModule({ ... })`, the manifest; the shell builds routes, nav, dashboard cards, quick add rows, settings rows, links and search from the manifests of the installed, visible modules and never names a module. `calendar` (everything moved) and `mascot` (a module with no data) are the references; the other modules have a manifest whose pages, cards and forms are still loaded from the kit (`import("@kit/pages/People")`), moving them in is the work below.

```
packages/modules/<key>/web/
  index.ts       the manifest (static imports stay light: pages, forms and cards are `import()` loaders)
  styles.css     optional; imported by the generated packages/web/src/styles/modules.generated.css (one Tailwind run with the app's CSS)
  paths.ts       the module's path constants, pages/, components/, cards/, forms/, types.ts, labels.ts, helpers
```

### The kit and the boundary

- A module's web code imports React, the npm packages `packages/web` has, `@kit/*` (an alias for `packages/web/src/*`) and its own files. Never another module's `web/`, `@fullfollow/*`, server or node code (`npm run check:boundaries` fails the build). `packages/web/src` never imports a module except `src/modules.generated.ts`.
- The kit is: the shell (`app/`), the UI kit (`components/ui.tsx`, `layout.tsx`, `ExpandOverlay`, `NumberField`, `MicButton`, `boardIcons`, `icons`, `components/forms/*`, `forms/shared`, `forms/helpers`, `forms/pickers`), the api client and store, tokens and the shared styles, `lib/format`, `lib/media`, the Dashboard and Settings hosts, the Comments page. Anything else that a screen uses moves with the screen; a helper two modules need stays in the kit only when it is generic (formatting, layout), domain helpers move and the other module reads the data through the API or a slot.
- Import order inside a manifest matters in one way: `defineWebModule` comes from `@kit/app/modules/define`, `linkTo` and `byRecord` from `@kit/app/modules/links`. Never import `app/modules/registry`, `api/actions` or `forms/meta` (they import the registry, which imports every manifest) statically from a manifest; inside a page, card or form that is loaded lazily they are fine.
- Lists never ask for "all": a list a screen needs whole (`useIndex`, `useQuery(path, drained)`) is read a page at a time until `total`; an endless list (people, companies, history) is `usePaged(path, size)` with a `<LoadMore>` at its end and the filters in the path; a picker is `Combo remote` (the server searches as the text is typed) and the global search is the manifest's `search` (`path` + `hit`). Counts a screen shows are the server's `total` or an aggregate route, never the length of a loaded list.
- Types the module owns move to `web/types.ts`; the Today sections the shell itself reads (`Plan`, `Task`, `Draft` ...) stay in `packages/web/src/api/types*.ts`.

### The manifest

```ts
defineWebModule({
  key, label,                                   // the server's key; Turkish name (the Settings "Modüller" switches)
  routes:   [{ page, path, params?, load }],    // load: () => import("./pages/Calendar") (default export); params "/:id?"
  nav:      [{ group, order, label, icon, path, useBadge? }],  // useBadge is a hook returning a count
  dashboard:[{ id, column?: 0|1|2, order, show?(today), load }], // load gives a component taking { today }
  settings: [{ id, category, order, rows(ctx) }],               // rows: SettingRow[]; ctx { floor, hasRules, withSession }
  settingsCategories: [{ slug, name, icon, sub?, order }],
  quickAdd: [{ kind, name, key, dest, icon, tone, group, order, form: FormMeta, load }], // load gives the form (FormProps)
  links:    { person: (id) => `/kisiler/${id}` },  // linkTo(type, id); null return = no page of its own
  search:   [{ id, order, path, hit(row, ctx) }],                // path: a list endpoint that takes `q` and `limit`; the server matches, `hit` makes the row a hit
  slots:    { "dashboard.tools": Component },      // or { order, Component }; may be a lazy() component
  invalidates: { tasks: ["/tasks", "/plan"], people: ["/plan"] }, // a write to a resource also refreshes these prefixes
})
```

Package.json of the module carries the two things build tools need without running the manifest: `"fullfollow": { "module": "<key>", "endpoints": ["/tasks", ...], "webMarkers": ["/takvim"] }`. `endpoints` are the API prefixes the module owns: the web never sends a read for a module that is not installed (the generated list includes switched off modules, as data only). `webMarkers` are strings that are in the web build exactly when the module is installed (a route path, a storage key): `npm run check:modules` searches every case's build for them. Add them when the module's path is no longer in `packages/web/src/app/routes.ts` (`PATHS`).

Slots that exist: `app.overlay` (props `{ onActivate }`, the mascot and the chat window), `dashboard.strip` (props `{ today }`, above the cards: the goal strip), `dashboard.tools` (the buttons next to "Yeni kayıt"). The other slots are named after the screen that hosts them: `report.sections` (the report page: the pipeline's source funnel, the templates' comparison), `timeline.aside` (props `{ type, id, detail, touches }`: the person, opportunity and project cards beside a focused record, each from the module that owns it), `opportunity.feed` (props `{ id, label }`: the timeline's feed on the opportunity page), `post.overlay.side` (props `{ post, people }`: the people and the opportunities of a post), `idea.actions` (props `{ idea }`: the own projects' "Projeye dönüştür" button). A screen that shows another module's data renders `<Slot name="person.overlay.side" props={{ id }} />` (from `@kit/app/modules/Slot`) and the owner registers a component under that name; the host knows nothing of the owner. Name a slot `<screen>.<place>`, list it here when you add one.

### Order numbers (one scale across modules; pick the number that keeps today's layout)

| Place | Numbers |
|---|---|
| Sidebar, group Network | today 10, calendar 20, people 30, companies 40, referrals 50, drafts 60, comments 70 |
| Sidebar, group Pazarlama | posts 10, ideas 20, templates 30 |
| Sidebar, group Satış ve projeler | pipeline 10, projects 20, own-projects 30, timeline 40, report 50, review 60 |
| Dashboard cards (global order, column) | review 10, plan 20 (col 0), drafts 30 (0), awaiting 40 (1), followups-due 50, follow-ups 60, payments 70 (1), activity 80 (1), quota 90, projects 100 (2), funnel 110 (2), cooling 120 (2), posts-due 130, comments 140 (2), status 150 |
| Quick add groups | Kişiler ve iletişim (person 10, company 20, touch 30, draft 40, comment 50), Satış (opportunity 10, offer 20, project 30), Plan (task 10, goal 20), Pazarlama (post 10, idea 20, template 30), Kendi işlerin (own_project 10) |
| Settings categories | hesap 10, isletme 20, takip 30, claude 40, maskot 50, liste 60, moduller 70, cop 80 |
| Settings rows of isletme | money and floor 10 (reports), weekly target 20, daily goals 30 (calendar), payment template 40 (reports) |
| Settings rows of takip | reply wait and cooling 10, follow-up days 20 (drafts), post refresh 30 (posts), daily send limits and warmup 40 (drafts) |
| Settings rows of claude | connection 10, sending without asking and learned rules 20 (drafts), pinned notes 30 (chat) |

Two modules may register the same dashboard `id` (projects and own-projects both show the projects card): the first one wins.

### Hide without removing

Settings has a "Modüller" section: one switch per installed module (core setting `modules_hidden`, `GET/PUT /api/settings`). `useModules()` gives `has(key)` (installed: use it before sending a request) and `visible(key)` (installed and not hidden: use it for everything that is only on screen). Routes, nav, cards, quick add, links, search, slots, settings rows and the chat widget follow `visible`; a hidden module's URL redirects to the dashboard, its data and API stay, turning it back on restores everything. MCP does not change.

### Moving a module into its web folder (what to do, in order)

1. `node scripts/web-move.mjs <key> <from>:<to> ...` moves files from `packages/web/src` with `git mv` and rewrites their imports (other moved files stay relative, everything left in the kit becomes `@kit/...`). Example: `node scripts/web-move.mjs calendar pages/Calendar.tsx:pages/Calendar.tsx components/calendar/:components/ lib/calendar.ts:calendar.ts styles/calendar.css:styles.css`. Move the page, its components, its dashboard cards, its forms (split a shared forms file by hand), its lib helpers and labels, its stylesheet (`styles.css`, delete its `@import` from `app.css`), its types.
2. Fix what the tool cannot: types that left `api/types.ts` (move them to `web/types.ts`), labels that left `lib/labels.ts` (`web/labels.ts`), `PATHS.<key>` (a constant in `web/paths.ts`), `recordPath` (use `linkTo`), `recordHref`-style helpers, a card that took props (give it `{ today }` or keep a small wrapper in `web/cards.tsx`).
3. Fill the manifest: the route, the nav item (`order` from the table), the dashboard cards, the forms with their `FormMeta` (`page`: `byRecord("<type>")`), `links`, `search`, `settings` rows (remove them from the kit's settings files), `slots`, `invalidates` (remove the module's rows from `AFFECTS` in `api/actions.ts` and from the `PLAN` style lists).
4. Everything that another screen showed of this module becomes a slot: the screen renders `<Slot>`, the module registers the component. A screen never calls `useModules().has("<key>")` to decide what to draw; it renders the slot.
5. Remove the module's entry from `PATHS` once nothing in the kit reads it, and the old table rows (`api/modules.ts` has none left: endpoints come from package.json). Add `webMarkers` to the module's package.json.
6. `styles.css` rules of a module are namespaced (`cal-*`); variables it uses stay in the CSS output because the file is compiled with the app's one Tailwind run. A token only read from JS (`getComputedStyle`) must also be used by some CSS rule or utility.
7. React compiler: a hook or component whose answer depends on module state (hidden, installed) must receive it as an argument or read it through a hook (`useRegistry()`, `useModules()`); a bare call such as `currentRegistry()` in render is cached for good. A function that reads a module level cache while rendering starts with `"use no memo"`.
8. Run `npm run build`, `npm test`, `npm run check:boundaries`, then `FF_MODULES_OFF=<key>` builds (`node scripts/build.mjs`, then `npx vite build` inside `packages/web`) and open every page: no console errors, nothing of the module left on screen, and `npm run check:modules --only=<key>`.
