# Modular architecture: plan

Goal (Özgür, 2026-10-14): every feature is a package with its own public API. Removing any package (Takvim, Referanslar, Satış hunisi, Kendi projelerim, even Kişiler) leaves the rest of the app building and running; a feature that needs another one degrades quietly when it is missing. Someone else can take a package (for example the calendar) and use it through its API without touching its inside.

This plan comes before the remaining UI screens: every screen from now on is built inside its module.

## 1. Shape

```
packages/
├─ core/         @fullfollow/core, the only thing every module depends on (today's core, reduced)
├─ app/          @fullfollow/app: composes core + installed modules (createApp); generated module list
├─ server/        NestJS host: uses app
├─ mcp/           MCP host: uses app
├─ web/           Vite host: shell, UI kit, loads installed modules
└─ modules/
   ├─ people/     one npm workspace package per feature: @fullfollow/mod-people
   │  ├─ api.ts       implements its contract from core/src/contracts/<m>.ts
   │  ├─ service/     services, rules, Zod schemas, constants, tests
   │  ├─ server/      its NestJS controllers
   │  ├─ mcp.ts       its MCP entities and tools
   │  └─ web/         its pages, components, styles, manifest
   ├─ companies/ calendar/ pipeline/ ...
```

Root `package.json` workspaces become `["packages/*", "packages/modules/*"]`.

### Core (not removable, holds only what every module needs)

`packages/core` stays and keeps its name; it is reduced to the pieces below and everything else moves out into modules.

- The data layer: DB client, WAL, backups, the whole Drizzle schema (every table, including the ones a module owns: cross-module foreign keys need the table objects, and the schema staying in core is what guarantees removal never drops data), the migration chain, `events` table, `settings` table and settings API, `trash` infrastructure (any module registers its trashable types), record type registry (`normalizeType`, `resolveRef`, labels come from modules), actor and `created_by`, clock, `FFError`.
- Module system: `defineModule`, the registry, the event bus, contribution points (below).
- Contracts: `core/src/contracts/<m>.ts` holds each module's public API as TypeScript types only (record shapes, the API interface, event payloads), plus the `ModuleApis` map. A contract stays when its module is removed, so code that optionally uses that module still typechecks; the contract is also what an outside user codes against. Core holds no behaviour of any module.
- Record attachments, because they hang on any record type by `(target_type, target_id)` and no feature owns them: comments (the MCP `unanswered` flow depends on them), notes, links, files, and the shared pick lists tags, sectors and sources (definitions only; the join tables such as `person_tags` belong to the module of the tagged record).
- Web: shell (sidebar, routes, Fab, search box, toasts), the Dashboard page as an empty host filled by module cards, the Settings page as a host filled by module sections, UI kit (`ui.tsx`, `layout.tsx`, `ExpandOverlay`, `NumberField`, `MicButton`, tokens), api client, `linkTo`.

### Modules and what they own

| Module | Owns (services / tables) | Uses (optional, via API) |
|---|---|---|
| people | people, person_tags, person_sectors, status, dupes for people, rhythm | companies, network |
| companies | companies, company_tags, company_sectors | people, network |
| network | touches, activity, network lists (awaiting, cooling), loose touches | people, companies |
| calendar | tasks, daily_goals, goal_logs, calendar feed, quick add | payments (projects), followups (drafts) |
| pipeline | opportunities, opportunity_people, offers, source funnel, lost reasons, Opportunity page | people, companies, network, projects |
| projects | projects, payments, maintenance, milestones | pipeline, calendar |
| drafts | drafts, followups, quota, subject, warmup | templates, people, network |
| templates | templates, template comparison | drafts |
| posts | posts, post refresh | network |
| ideas | ideas, idea_sectors, idea_people | people |
| own-projects | own_projects, own_project_sectors | ideas |
| referrals | referral report (reads `people.referred_by_id` through the people API) | people, pipeline, projects |
| reports | Report, Haftalık inceleme, monthly floor | every money and activity module through contributions |
| timeline | event feed views | all, through event labels from modules |
| chat | Claude chat bridge (server runner, sessions, chat_sessions, chat_messages, chat_attachments), chat widget | every module through record chips and search |
| mascot | the mascot and its settings | chat (opens it when present) |

A table belongs to exactly one module. "Uses" is never a hard import: it is `core.mod("pipeline")?.…` returning `undefined` when the package is missing.

## 2. Rules that make removal safe

1. **Imports.** A module imports only `@fullfollow/core` (including the contracts). Never another module's package. Core never imports a module; only `@fullfollow/app` (generated list) and the web's Vite glob load modules. A check script (`npm run check:boundaries`) fails the build on a violation.
2. **Runtime access.** `ctx.mod<"pipeline">("pipeline")` returns the typed API or `undefined`. Every call site handles `undefined`.
3. **Cross-module rules are event hooks**, run synchronously inside the same transaction as the event that triggers them (golden rule kept: events written in core, one transaction):
   - `opportunity.won` → projects opens a project with its payments (offer data travels in the payload, so projects never reads pipeline tables).
   - `touch.created` → pipeline advances the stage; ideas updates interest; drafts updates quota.
   - `draft.sent` → network records the touch.
   - `record.trashed` / `record.restored` → modules clean or restore what points at the record.
   The trigger never knows who listens. A hook returns effect strings (the existing `effects` list).
4. **Contribution points** instead of aggregators that import everything:
   - core: `today` sections, `report` sections, `review` facts, `search` providers, `save`/`find`/`get`/`delete` entity handlers, trash types, record labels, timeline event labels.
   - server: Nest controllers per module.
   - mcp: entity types and tool snippets; the generic tools (`save`, `find`, `get`, `delete`, `today`, `report`, `timeline`) list only installed entity types; module tools (`move` pipeline, `pay` projects, `draft` drafts, `plan` calendar) exist only when the module is installed.
   - web: routes, nav item (group, order, label, icon, badge query), dashboard cards (column, order), settings sections, Fab quick add items, record links (`linkTo(type, id)` returns `null` when no module serves that type; the link renders as plain text), overlay panels shown on another module's record (e.g. pipeline adds "Açık fırsat" to the person overlay).
5. **Discovery.**
   - web: `packages/web/src/modules.generated.ts` (also written by `scripts/gen-modules.mjs`) statically imports every installed module's `web/index.ts`; `import.meta.glob` cannot see `FF_MODULES_OFF`.
   - core, server, mcp: `packages/app/src/modules.generated.ts` written by `scripts/gen-modules.mjs`, which scans `packages/modules/*/package.json` (field `"fullfollow": { "module": "<key>" }`). Server and MCP call `createApp(handle, actor)` from `@fullfollow/app`; core stays free of module imports (no package cycle). Cross-module tests (e.g. won opportunity opens a project) live in `packages/app/test`. It runs in `npm run build`, `npm test`, `npm start`. It also honours `FF_MODULES_OFF=a,b` (used by the removal check and to switch a module off without deleting it).
   - The server exposes `GET /api/modules`; the web shows a module only when the server has it too.
6. **Hide without removing.** Settings gets a "Modüller" section listing installed modules with a switch each (setting `modules_hidden`, a list). A hidden module disappears from the web (nav, routes, cards, widgets, links, quick add) but its data, API and hooks keep working, so turning it back on loses nothing. Removing the package (or `FF_MODULES_OFF`) takes it out entirely.
7. **Data is never lost by removing code.** Every table stays defined in core's schema; a module owns its tables by convention (only its services write them) and through its contract types. Removing a module never runs a migration; its rows stay and come back with the package. `db:generate` refuses while a module is switched off.
8. **Foreign keys across modules.** Inside one module foreign keys stay. Across modules (e.g. `opportunities.person_id` → `people`) they stay too, because every table always exists in this database. For someone who installs only a subset on a fresh database, the generated chain for their set is what matters; this is handled later (section 5) and does not block the split.
9. **Tests** move into their module (`packages/modules/<m>/service/*.test.ts`). The core has tests for the registry, the event bus and the boundary rule.

## 3. Removal check

`npm run check:modules` (`scripts/check-modules.mjs`): for each module, then all off, then all on, set `FF_MODULES_OFF`, regenerate the registry, typecheck and build every package (`tsc -b`), run every remaining test (any failing package fails the case), start the server on a free port in 3021..3029 against a seeded copy of the demo database, request the core endpoints plus the `smoke` paths each module declares, check `/api/modules` lists exactly the installed keys, fetch the page and its main bundle (the web is built once, all on, before the cases), then start the MCP host over stdio (`tools/list` without the tools of the off modules, `today`, `find` of every installed type). One line per case: `pass <case>` or `FAIL <case>: <first error>`; logs per case in `$FF_CHECK_LOGS` (default: the OS temp folder). The generated lists and the build are put back to all on at the end, also after a failure. Run at the end of every phase from P3 on, and before every merge. Since P4a every case also builds the web with the generated web list of that case (`vite build`; the typecheck runs once, all on) and searches the build for the `fullfollow.webMarkers` of the modules (a route path, a storage key): present exactly when the module is installed.

## 4. Phases (each one a Sonnet agent with a brief written from this plan; one at a time, in the worktree, on `claude/yeni-arayuz`)

| Phase | Work | Done when |
|---|---|---|
| P1 | Core: module system (`defineModule`, registry, `ctx.mod`, event bus inside transactions, contribution points, contracts folder). `packages/app` with `createApp` and `gen-modules.mjs`; server and MCP switch to `createApp`. Boundary check script. Nothing moves yet; with zero modules `createApp` equals today's core, so nothing breaks. | build, tests, boundary check pass; registry and bus tests |
| P2 | Vertical moves, one sub step per agent: each module leaves core with its services, its contract in `core/src/contracts`, its NestJS controllers (`modules/<m>/server`, loaded through a generated list in packages/server), its MCP entities and tools, its tests, and its contributions (today, report, search, trash types, labels). (a) pattern + calendar + posts; (b) people, companies, network; (c) pipeline, projects with the cross-rules as hooks; (d) drafts, templates, ideas, own-projects, referrals; (e) reports, timeline, chat, mascot server side; then `createCore` keeps only core. `/api/modules` added in (a). | after each sub step: build, all tests, boundary check pass; every HTTP endpoint and MCP tool unchanged with all modules installed |
| P3 | `check:modules` script; run it, fix every module whose removal breaks core, server or MCP. | one pass line per module |
| P4 | Web: module manifests (plus the Settings "Modüller" switches), shell builds routes, nav, Fab, dashboard, settings, links from the registry; pages and their components move into `modules/<m>/web/`. Dashboard cards move to their modules. | app looks and works the same; `check:modules` passes for every module. **P4a done**: manifest system, shell reads the registry, Modüller switches, mascot and calendar moved, per case web build in `check:modules` (steps for the rest: `packages/modules/README.md`, "Web part"); P4b moves the other modules |
| P5 | Resume the UI screens (People done before the split) inside their modules, as planned in `docs/plan-arayuz.md`. | per screen, as in that plan |

Risk control: before P2 and before P3, a better-sqlite3 backup of the live database. No phase changes the database schema; table definitions move files, the generated SQL must be empty (`db:generate` produces no migration). The live panel on port 3000 keeps running from the main checkout until the branch is merged.

## 5. Later, not part of this work
- Per subset fresh installs (a separate migration chain per chosen module set, cross-module foreign keys as plain integer columns).
- Publishing module packages for use outside this repo.
