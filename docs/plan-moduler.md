# Modular architecture: plan

Goal (Özgür, 2026-10-14): every feature is a package with its own public API. Removing any package (Takvim, Referanslar, Satış hunisi, Kendi projelerim, even Kişiler) leaves the rest of the app building and running; a feature that needs another one degrades quietly when it is missing. Someone else can take a package (for example the calendar) and use it through its API without touching its inside.

This plan comes before the remaining UI screens: every screen from now on is built inside its module.

## 1. Shape

```
packages/
├─ platform/      the only thing every module depends on
├─ server/        NestJS host: loads platform + installed modules
├─ mcp/           MCP host: loads platform + installed modules
├─ web/           Vite host: shell, UI kit, loads installed modules
└─ modules/
   ├─ people/     one npm workspace package per feature: @fullfollow/mod-people
   │  ├─ api.ts       public contract: types + the API interface (the only file other modules may import)
   │  ├─ core/        services, rules, Zod schemas, constants, tests
   │  ├─ schema.ts    its tables (Drizzle)
   │  ├─ server/      its NestJS controllers
   │  ├─ mcp.ts       its MCP entities and tools
   │  └─ web/         its pages, components, styles, manifest
   ├─ companies/ calendar/ pipeline/ ...
```

Root `package.json` workspaces become `["packages/*", "packages/modules/*"]`.

### Platform (not removable, holds no feature)
- DB client, WAL, backups, the migration chain, `events` table, `settings` table and settings API, `trash` infrastructure (any module registers its trashable types), record type registry (`normalizeType`, `resolveRef`, labels come from modules), actor and `created_by`, clock, `FFError`.
- Module system: `defineModule`, the registry, the event bus, contribution points (below).
- Comments stay platform: a comment targets any record type by `(target_type, target_id)`; the MCP `unanswered` flow depends on it. Chat (Claude bridge) is platform too.
- Web: shell (sidebar, routes, Fab, search box, toasts), UI kit (`ui.tsx`, `layout.tsx`, `ExpandOverlay`, `NumberField`, `MicButton`, tokens), api client, `linkTo`.

### Modules and what they own

| Module | Owns (services / tables) | Uses (optional, via API) |
|---|---|---|
| people | people, person_tags, person_sectors, status, dupes for people, rhythm | companies, sectors |
| companies | companies, company_tags, company_sectors | people |
| categories | sectors, tags, sources (shared pick lists) | |
| network | touches, notes, links, files, activity, network lists (awaiting, cooling), loose touches | people, companies |
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
| dashboard | Today page host | all, through dashboard cards |

A table belongs to exactly one module. "Uses" is never a hard import: it is `core.mod("pipeline")?.…` returning `undefined` when the package is missing.

## 2. Rules that make removal safe

1. **Imports.** A module imports only `@fullfollow/platform` and the `api.ts` of another module (types only, `import type`). Never another module's `core/`, `web/`, `server/`. Platform and hosts never import a module by name. A check script (`npm run check:boundaries`) fails the build on a violation.
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
   - web: `import.meta.glob("../../modules/*/web/index.ts", { eager: true })`, native Vite, nothing to edit when a folder disappears.
   - core, server, mcp: a generated registry `packages/platform/src/modules.generated.ts` written by `scripts/gen-modules.mjs`, which scans `packages/modules/*/package.json`. It runs in `npm run build`, `npm test`, `npm start`. It also honours `FF_MODULES_OFF=a,b` (used by the removal check and to switch a module off without deleting it).
   - The server exposes `GET /api/modules`; the web shows a module only when the server has it too.
6. **Data is never lost by removing code.** Tables are defined in the module packages, but the migration chain is one, owned by platform, generated from every module present in this repo. Removing a module never runs a migration; its tables and rows stay in the database and come back when the package returns. `gen-modules` refuses to let `db:generate` run while a module is switched off, and a check fails any generated migration containing `DROP TABLE`.
7. **Foreign keys across modules.** Inside one module foreign keys stay. Across modules (e.g. `opportunities.person_id` → `people`) they stay too, because every table always exists in this database. For someone who installs only a subset on a fresh database, the generated chain for their set is what matters; this is handled later (section 5) and does not block the split.
8. **Tests** move into their module (`packages/modules/<m>/core/*.test.ts`). The platform has tests for the registry, the event bus and the boundary rule.

## 3. Removal check

`npm run check:modules`: for each module, set `FF_MODULES_OFF=<m>`, regenerate the registry, typecheck every package, run every remaining test, build the web, start the server on a free port and request `/api/health` and `/api/today`. One line per module: pass or the first error. Run at the end of every phase from P3 on, and before every merge.

## 4. Phases (each one a Sonnet agent with a brief written from this plan; one at a time, in the worktree, on `claude/yeni-arayuz`)

| Phase | Work | Done when |
|---|---|---|
| P1 | Platform package: module system (`defineModule`, registry, `ctx.mod`, event bus inside transactions, contribution points), `gen-modules.mjs`, boundary check script. Move platform pieces out of core. Core keeps working unchanged by re-exporting, so nothing else breaks yet. | build, tests, boundary check pass; registry and bus tests |
| P2 | Move core services into module packages, a few per agent: (a) categories, people, companies, network; (b) calendar, pipeline, projects, with the cross-rules as hooks; (c) drafts, templates, posts, ideas, own-projects, referrals; (d) reports, timeline, today as contributions. Each module gets `api.ts`. `createCore` becomes the composer. Existing tests move with their module and still pass. | after each sub step: build and all tests pass, MCP and web unchanged |
| P3 | Server and MCP: controllers into modules, generated module list in `app.module.ts`, MCP entities and tools from modules, `/api/modules`. | MCP tool list and every endpoint unchanged with all modules installed; `check:modules` passes for core + server + mcp |
| P4 | Web: module manifests, shell builds routes, nav, Fab, dashboard, settings, links from the registry; pages and their components move into `modules/<m>/web/`. Dashboard cards move to their modules. | app looks and works the same; `check:modules` passes for every module |
| P5 | Resume the UI screens (People done before the split) inside their modules, as planned in `docs/plan-arayuz.md`. | per screen, as in that plan |

Risk control: before P2 and before P3, a better-sqlite3 backup of the live database. No phase changes the database schema; table definitions move files, the generated SQL must be empty (`db:generate` produces no migration). The live panel on port 3000 keeps running from the main checkout until the branch is merged.

## 5. Later, not part of this work
- Per subset fresh installs (a separate migration chain per chosen module set, cross-module foreign keys as plain integer columns).
- Publishing module packages for use outside this repo.
