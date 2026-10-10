# Plan: Kendi projelerim (own products)

Status: approved for implementation when Özgür says go. Written 2026-10-10.
Audience: the implementing session. Follow it literally; where it is silent, mirror how `idea` is done today.

## 0. Goal

Özgür builds products for himself (Full Follow is the first). He wants them tracked as their own records:

- whether a product could be sold later (yes / no / maybe, plus a note),
- which sectors it suits (DB backed sectors, several per product),
- a status,
- a prioritised list of ideas that belong to that product,

while the general ideas page keeps only money making ideas and is renamed **"Para kazanma fikirleri"**.

## 1. Decisions

### 1.1 Separate entity, not a flag on `projects`

New table `own_projects`. The client `projects` table is a delivery record: `person_id NOT NULL`, `price`, a payment plan, stages `pesinat..bakim`, and it feeds revenue reports, `today()` payments and the opportunity "kazanıldı" rule. A type flag would force `person_id` nullable (table rebuild) and a `kind = 'client'` filter in every finance query; one missed filter corrupts the money numbers. Own products share none of those fields, so they get their own table and their own page.

### 1.2 Ideas stay one table; scope is a column

Ideas keep living in `ideas`. A new nullable `ideas.own_project_id` decides the scope:

- `own_project_id IS NULL`: general idea, shown on **Para kazanma fikirleri** (`/fikirler`).
- `own_project_id = N`: idea of own project N, shown only on that project's detail.

Reason: moving an idea between scopes is a single column update, comments/trash/MCP for ideas keep working, and nothing is copied.

### 1.3 `ideas.parent_id` keeps working, but only for general ideas

Today `parent_id` is used as "own project" (Full Follow #3 has sub ideas #1, #2, #22) and also as plain sub idea grouping (AI danışmanlığı #11 > Küçük işletme asistanı #12). After this change `parent_id` means only "üst fikir" inside the general list. Rules:

- An idea with `own_project_id` set always has `parent_id = NULL` and has no children.
- An idea that has children cannot move into a project (error, see §3.2).

Existing data is not rewritten by the SQL migration. The Full Follow idea is converted with the new **"Projeye dönüştür"** action (§3.3) as the last step (§9 step 8). AI danışmanlığı stays a general idea with its sub idea.

### 1.4 Ordering: priority groups plus drag order

Project ideas have `priority` (`yuksek | orta | dusuk`) and `position`. The list is three groups in that fixed order; `position` is the order inside a group (0 = top). Dragging inside a group reorders; dragging into another group changes the priority and places it at the drop index. This is the same model as the sales pipeline (stage = group, position inside), so the reorder code is shared (§3.1).

Done ideas (`done_at` set) leave the groups and sit in a collapsed "Yapılanlar" list.

### 1.5 Names

| Thing | Name |
|---|---|
| General ideas page title | Para kazanma fikirleri |
| General ideas sidebar label | Para fikirleri |
| Own products page title and sidebar label | Kendi projelerim |
| Client projects sidebar label (was "Projeler") | Müşteri projeleri (page title "Proje panosu" unchanged) |
| Record type (code, MCP) | `own_project` |
| Route | `/projelerim`, detail `/projelerim/:id` |
| REST resource | `/api/own-projects` |

## 2. Schema and migration

### 2.1 Constants (`packages/core/src/constants.ts`)

```ts
/** Own product lifecycle */
export const OWN_PROJECT_STATUSES = ["aktif", "beklemede", "tamamlandi", "birakildi"] as const;
/** Could this own product be sold later */
export const SELLABLE = ["evet", "belki", "hayir"] as const;
/** Project idea priority, in display order */
export const IDEA_PRIORITIES = ["yuksek", "orta", "dusuk"] as const;
```

Also:

- `TRASH_TYPES` add `"own_project"`.
- `COMMENT_TARGETS` add `"own_project"`.
- `LINK_TARGETS` add `"own_project"` (repo, demo, store links reuse `links`).
- `RECORD_TYPES` add `"own_project"`.
- `TYPE_ALIASES` add `own: "own_project", own_projects: "own_project", kendi_proje: "own_project", "kendi projem": "own_project", projelerim: "own_project", urunum: "own_project"`.
- `LABELS` add `aktif: "aktif", beklemede: "beklemede", tamamlandi: "tamamlandı", birakildi: "bırakıldı", yuksek: "yüksek", orta: "orta", dusuk: "düşük", evet: "evet", belki: "belki", hayir: "hayır"`.

### 2.2 Tables (`packages/core/src/db/schema.ts`)

Add a section `// ---------------------------------------------------------------- Kendi projelerim` after `idea_people`:

```ts
/** Own products Özgür builds for himself (Full Follow); not client work, no payments */
export const own_projects = sqliteTable("own_projects", {
  ...common(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: OWN_PROJECT_STATUSES }).notNull().default("aktif"),
  sellable: text("sellable", { enum: SELLABLE }).notNull().default("belki"),
  /** who could buy it and how */
  sellable_note: text("sellable_note"),
  notes: text("notes"),
}, (t) => [index("own_projects_status").on(t.status)]);

export const own_project_sectors = sqliteTable("own_project_sectors", {
  own_project_id: integer("own_project_id").notNull().references(() => own_projects.id),
  sector_id: integer("sector_id").notNull().references(() => sectors.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.own_project_id, t.sector_id] }), index("own_project_sectors_sector").on(t.sector_id)]);
```

Change `ideas` (keep every existing column):

```ts
  /** Sub idea grouping inside general ideas only (one level) */
  parent_id: ...unchanged...,
  /** Own project this idea belongs to; null = general money idea */
  own_project_id: integer("own_project_id").references((): AnySQLiteColumn => own_projects.id),
  /** Only meaningful inside a project */
  priority: text("priority", { enum: IDEA_PRIORITIES }).notNull().default("orta"),
  position: integer("position").notNull().default(0),
  done_at: text("done_at"),
}, (t) => [index("ideas_own_project").on(t.own_project_id, t.priority, t.position)]);
```

Update the old `parent_id` doc comment as above (it currently says "Own project this idea belongs to").

### 2.3 Migration

Run `npm run db:generate -w @fullfollow/core -- --name own_projects`. Expected file `packages/core/src/db/migrations/0011_own_projects.sql` plus `meta/0011_snapshot.json` and a journal entry. It must contain only `CREATE TABLE own_projects`, `CREATE TABLE own_project_sectors`, their indexes, four `ALTER TABLE ideas ADD ...` and `CREATE INDEX ideas_own_project`. If drizzle-kit proposes a rebuild of `ideas` (DROP/RENAME), stop: something else changed in the schema.

Data safety: additive only. Existing ideas get `own_project_id NULL`, `priority 'orta'`, `position 0`, `done_at NULL`, so the current general list is unchanged.

Acceptance (on a copy, never on the live file):

```bash
cp data/fullfollow.db "$TMP/ff-copy.db" && FF_DB="$TMP/ff-copy.db" node -e "const c=require('./packages/core/dist');const h=c.openDb();console.log(h.sqlite.prepare('select count(*) n from ideas').get(), h.sqlite.prepare('select count(*) n from own_projects').get());h.close()"
```

(build core first; use the scratchpad dir as `$TMP`). Expect the same idea count as before (8 on 2026-10-10), 0 own projects, no foreign key error from `openDb`.

## 3. Core

### 3.1 Shared helpers (refactor first, behaviour unchanged)

1. **Group reorder.** Move the "insert into column and renumber" block from `applyStage` in `services/opportunities.ts` into `services/shared.ts`:

   ```ts
   /** Puts `id` at `position` (default: end) among rows matching `where`, renumbers that group 0..n */
   export function placeInGroup(q: Q, ctx: Ctx, table: "opportunities" | "ideas", where: string, args: unknown[], id: number, position?: number): void
   ```

   Implementation: `SELECT id FROM ${table} WHERE ${where} AND id != ? ORDER BY position, id`, splice, then `UPDATE ${table} SET position = ? WHERE id = ?` for each (raw prepared statement through `ctx`, or the drizzle table object picked from a two entry map). `applyStage` calls it with `"stage = ?", [stage]`. Also export `renumberGroup(q, ctx, table, where, args)` (same query without inserting) for the group an item leaves.
2. **Sector links.** Move `withSectors` and `setSectors` out of `services/ideas.ts` into `services/sectors.ts` as:

   ```ts
   export function sectorInput(q: Q, ctx: Ctx, input: unknown): unknown   // was withSectors
   export function setSectorLinks(q: Q, ctx: Ctx, owner: "idea" | "own_project", ownerId: number, ids: number[]): void   // was setSectors
   ```

   `setSectorLinks` picks `idea_sectors/idea_id` or `own_project_sectors/own_project_id` from a two entry map. `ideas.ts` imports them.
3. **Sector filter.** Extract the inline sector filter in `queries.ts > ideas()` into `function sectorMatch(ctx, sector: string | number): number[]` (returns the sector id plus sub sector ids, empty if unknown) and use it in both `ideas()` and the new `ownProjects()` list.

Run `npm test` after this step: all existing tests must stay green.

### 3.2 Idea rules (`services/ideas.ts`)

Schemas (`packages/core/src/schemas/index.ts`):

```ts
ideaCreate: add  own_project_id: id.nullish(), priority: z.enum(IDEA_PRIORITIES).optional()
ideaUpdate: add  own_project_id: id.nullable(), priority: z.enum(IDEA_PRIORITIES), position: z.number().int().min(0), done: z.boolean()
```

Rules, all inside the existing create/update transactions:

- **R1 scope.** Resulting `own_project_id` set (incoming value, else current) means:
  - `parent_id` is forced to `null` (incoming non null `parent_id` → `FFError("validation", "proje fikri bir üst fikrin altına konamaz")`);
  - if the idea has children → `FFError("validation", "alt fikirleri olan fikir projeye taşınamaz; önce alt fikirleri ayır")`;
  - the project must exist (`requireRow(ctx, "own_projects", id, "kendi projesi")`).
  - `checkParent` additionally rejects a parent whose `own_project_id` is set ("proje fikri üst fikir olamaz").
- **R2 order.** Group of an idea = `own_project_id = ? AND priority = ? AND done_at IS NULL`.
  - create inside a project: `position` = end of its group (use `placeInGroup` with no position).
  - update: if `own_project_id`, `priority`, `position` or `done` is in the input, renumber the old group (if the idea was in one) and `placeInGroup` into the new group at `position` (end when absent). An idea that ends up done or general is not placed.
- **R3 done.** `done: true` sets `done_at = now`, `done: false` sets `done_at = null` and places it at the end of its priority group. `done` is stripped before the DB update (not a column). Event `idea.done` summary `Fikir yapıldı: <title>` / `idea.undone` `Fikir geri açıldı: <title>`.
- **R4 move between scopes.** When `own_project_id` changes, event `idea.moved`, summary `Fikir taşındı: <title> → <project name>` or `→ Para kazanma fikirleri`, data `{ idea_id, from, to }`. Moving to general sets `done_at = null` and `position = 0`; `priority` is kept.
- **R5.** `priority`, `position`, `done` on an idea whose resulting `own_project_id` is null → `FFError("validation", "öncelik, sıra ve yapıldı sadece proje fikirlerinde")`.
- Extract the body of `remove()` into `export function trashIdea(tx: Q, ctx: Ctx, id: number)` so `fromIdea` (§3.3) can call it inside its own transaction; `remove()` calls it.

`ideaStats` adds `(SELECT name FROM own_projects o WHERE o.id = i.own_project_id) AS own_project_title`. Columns `priority`, `position`, `done_at`, `own_project_id` come with `i.*`.

### 3.3 Own projects service (`services/ownProjects.ts`, new)

Schemas:

```ts
export const ownProjectCreate = z.strictObject({
  name: text, description: optText, status: z.enum(OWN_PROJECT_STATUSES).default("aktif"),
  sellable: z.enum(SELLABLE).default("belki"), sellable_note: optText, notes: optText,
  sector_ids: z.array(id).optional(),
});
export const ownProjectUpdate = patch({
  name: text, description: optText, status: z.enum(OWN_PROJECT_STATUSES),
  sellable: z.enum(SELLABLE), sellable_note: optText, notes: optText, sector_ids: z.array(id),
});
```

`export function ownProjectsService(ctx: Ctx)` returns `{ create, update, move, remove, fromIdea }`:

- `create(input)`: `sectorInput` → parse → insert → `setSectorLinks("own_project", ...)` → event `own_project.created` `Kendi projesi: <name>` data `{ own_project_id }`.
- `update(id, input)`: like ideas. Status change → event `own_project.status` `Proje <eski> → <yeni>: <name>`, effect `proje → <label>`; other change → `own_project.updated`.
- `move(id, status)`: validates against `OWN_PROJECT_STATUSES`, calls `update`.
- `remove(id)`: one transaction with `Bin`: `bin.unlink("ideas", "own_project_id", id)` (its ideas fall back to the general list, restore re-links them), `bin.take("own_project_sectors", "own_project_id = ?", id)`, `bin.take("links", "target_type = 'own_project' AND target_id = ?", id)`, `bin.take("comments", "target_type = 'own_project' AND target_id = ?", id)`, `bin.take("own_projects", "id = ?", id)`, `bin.commit(tx, "own_project", id, name)`, event `own_project.deleted`. Note: unlinked ideas keep their `priority/position/done_at`; that is fine, R5 only checks inputs.
- `fromIdea(ideaId)`: "Projeye dönüştür". Preconditions: idea exists, `own_project_id IS NULL`, `parent_id IS NULL` (else `FFError("validation", "sadece en üstteki genel fikir projeye dönüşür")`). One transaction:
  1. insert own project `{ name: idea.title, description: idea.problem, notes: idea.notes, status: "aktif", sellable: "belki" }`, copy its `idea_sectors` rows into `own_project_sectors`;
  2. children ordered by `id`: set `parent_id = null`, `own_project_id = new id`, `priority = "orta"`, `position = 0..n-1`, `updated_at = now`;
  3. `trashIdea(tx, ctx, ideaId)` (children are already detached, so restore brings it back as a plain general idea);
  4. event `own_project.created` `Fikirden proje: <name>` data `{ own_project_id, idea_id }`.
  Returns `{ row: project, effects: ["<n> fikir projeye taşındı", "kaynak fikir çöp kutusunda"] }`.

### 3.4 Wiring

Every place that lists `"idea"` as a record, comment, link, trash or ref type gets an `own_project` sibling. Find them with `grep -rn '"idea"\|idea:' packages/core/src`. Known places:

- `services/shared.ts`: `TARGET_TABLE.own_project = "own_projects"`, `TABLE_LABEL.own_projects = "kendi projesi"`, `targetLink` → `link(ctx, {})`, `targetLabel` → `SELECT name FROM own_projects`, `REF_TABLES.own_project = { table: "own_projects", col: "name", label: "kendi projesi" }`, `INPUT_REFS.own_project = ["own_project_id", "own_project"]`.
- `services/trash.ts`: label `own_project: "kendi projesi"` and restore support exactly like `idea`.
- `services/links.ts` / schema `linkCreate`: accepts `own_project` via `LINK_TARGETS`. `queries.ts > linkList`: `if (f.own_project_id) list = list.filter((l) => l.target_type === "own_project" && l.target_id === Number(f.own_project_id))`.
- `services/queries.ts`:
  - `ownProjectStats(ctx)`: `SELECT o.*, (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NULL) AS open_ideas, (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NOT NULL) AS done_ideas FROM own_projects o`, sectors attached the same way as `ideaStats`, sorted by `OWN_PROJECT_STATUSES` index then `updated_at DESC`.
  - list `own_project`: filters `status`, `sellable` (comma lists allowed, like person `status`), `sector` (via `sectorMatch`), `q` over name/description/notes.
  - list `idea`: new filters `own_project` (id or name → `resolveRef(ctx, "own_project", v)`) and `general` (truthy → `own_project_id == null`).
  - `relatedFor.own_project = ["ideas", "links", "comments"]`; `related.ideas` for an own project = its ideas from `ideaStats`, ordered open first, then `IDEA_PRIORITIES` index, `position`, `id`, done ones last by `done_at DESC`. `get("own_project", id)` uses `ownProjectStats`. `COMMENT_TYPES` add `own_project`.
- `index.ts`: `ownProjects = ownProjectsService(ctx)`; `save`: `case "own_project": return d?.from_idea !== undefined ? ownProjects.fromIdea(resolveRef(ctx, "idea", d.from_idea)) : nid ? ownProjects.update(nid, d) : ownProjects.create(d)`; `move`: `if (t === "own_project") return ownProjects.move(nid, stage)` and extend the error text; `remove`: `case "own_project"`; export `ownProjects` on the core object; widen the `resolveRef` type union.

### 3.5 Core tests (`packages/core/test/own-projects.test.ts`, new; same setup as `paket3.test.ts`)

Numbered after the existing ones. Exactly these four:

- **20. kendi projesi**: create with `sectors: ["Yazılım > SaaS"]` creates the sector; `sellable` defaults to `belki`; `move` to `beklemede` writes an `own_project.status` event; `find own_project {status:'beklemede'}`, `{sellable:'belki'}`, `{sector:'Yazılım'}` each return it.
- **21. fikir kapsamı**: an idea saved with `own_project: "<name>"` gets `parent_id` null; saving with both `own_project_id` and `parent_id` throws; an idea with a child cannot move into a project; a project idea cannot be a parent; `own_project_id: null` brings it back with `done_at` null; `priority` on a general idea throws.
- **22. sıralama**: three ideas in `orta` get positions 0,1,2; `position: 0` on the last makes it 0 and shifts the others; changing `priority` to `yuksek` with `position: 0` puts it on top of `yuksek` and renumbers `orta` to 0..1; `done: true` removes it from the group (others renumbered), `done: false` puts it at the end of its group.
- **23. fikirden proje**: idea "Full Follow" with two children and one sector → `save own_project {from_idea:"Full Follow"}` gives a project with that sector, the children in it with `parent_id` null and positions 0,1, the source idea in trash; restoring it gives a general idea with no children; deleting the project sends its ideas to the general list and restoring the project re-links them.

The existing test "fikir projeleri: iki seviye" stays; only rename its title to "üst fikir: iki seviye, alt fikir üst fikrin altında listelenir".

Update `docs/MIMARI.md` §6 list with tests 20 to 23.

## 4. REST (`packages/server`)

New `controllers/own-projects.controller.ts`, registered in `app.module.ts`, same style as `ideas.controller.ts`:

| Method | Path | Core call |
|---|---|---|
| GET | `/api/own-projects` | `find("own_project", listOpts(query))` |
| GET | `/api/own-projects/:id?with=ideas,links,comments` | `get("own_project", intId(id), withList(w), 200)` |
| POST | `/api/own-projects` | `ownProjects.create(b)` |
| POST | `/api/own-projects/from-idea/:ideaId` | `ownProjects.fromIdea(intId(ideaId))` |
| PATCH | `/api/own-projects/:id` | `ownProjects.update` |
| DELETE | `/api/own-projects/:id` | `remove("own_project", ...)` |

Existing endpoints that just gain fields, no code change beyond core: `PATCH /api/ideas/:id` (`own_project_id`, `priority`, `position`, `done`), `GET /api/ideas?general=1` / `?own_project=3`, `GET /api/links?own_project_id=3`, `POST /api/links` and `POST /api/comments` with `target_type: "own_project"`.

## 5. MCP (`packages/mcp`), token light

No new tool. Edit description strings only where listed, keep them short:

- `find`: add `own_project` to the type list; filters `own_project {status,sellable,sector}`, `idea {stage,sector,own_project:'Full Follow',general:true}`.
- `get`: `own_project: ideas,links,comments`.
- `save`: replace the idea sentence with `idea: {title,problem,stage,sectors,notes,parent:'üst fikir' (sadece genel), own_project:'Full Follow'|null (null = genel), priority:yuksek|orta|dusuk, position (0 = üst), done:true|false}`; add `own_project: {name,description,status,sellable:evet|belki|hayir,sellable_note,sectors,notes}; {from_idea:'fikir adı'} fikri projeye çevirir (alt fikirler taşınır, fikir çöpe)`; `link target_type` add `own_project`.
- `move`: add `Kendi projesi: aktif|beklemede|tamamlandi|birakildi.`
- `format.ts`:
  - `LINE.own_project = (r) => join(`#${r.id} ${r.name}`, label(r.status), `satılabilir: ${label(r.sellable)}`, `${r.open_ideas} açık fikir`, r.sectors?.map((x) => x.path).join(", "))`.
  - `LINE.idea`: when `r.own_project_id`, print `proje: <own_project_title>`, `label(r.priority)` and `yapıldı` if `done_at`, and skip the stage and interest numbers.
  - `KIND_NAME.own_project = "kendi projesi"`; add `description, status, sellable, sellable_note, open_ideas, done_ideas, own_project_title, priority, done_at` to the field allowlist used by `block`.
  - `block` for `own_project` prints `related.ideas` as idea lines.

## 6. Web (`packages/web`)

Design rules: only existing tokens and classes (`card`, `row`, `inset`, `chip`/`Chip` tones, `btn btn-pri|btn-sec|btn-ghost`, `ibtn`, `fchip`, `rise` + `order(n)`, `slide-in`). No hex, no raw px, no new durations. Chip tones map:

| Value | Tone |
|---|---|
| status aktif / beklemede / tamamlandi / birakildi | success / payment / opportunity / neutral |
| sellable evet / belki / hayir | success / payment / neutral |
| priority yuksek / orta / dusuk | warning / payment / neutral |

### 6.1 Data layer

- `api/types.ts`: `OwnProjectStatus`, `Sellable`, `IdeaPriority` unions; `interface OwnProject extends Base { name; description; status; sellable; sellable_note; notes; open_ideas; done_ideas; sectors: { id: number; path: string }[] }`; `Idea` adds `own_project_id: number | null; own_project_title: string | null; priority: IdeaPriority; position: number; done_at: string | null`.
- `api/keys.ts`: `K.ownProjects = `/own-projects?limit=${ALL}``, `export const useOwnProjects = (on = true) => useIndex<OwnProject>(on ? K.ownProjects : null)`.
- `api/actions.ts > AFFECTS`: `"own-projects": ["/own-projects", "/ideas", "/links", "/comments", "/trash"]`; add `"/own-projects"` to `ideas` (create the `ideas` entry if missing: `["/ideas", "/own-projects", "/trash"]`), `links` and `comments`.
- `lib/labels.ts`: `OWN_STATUS` (`Aktif, Beklemede, Tamamlandı, Bırakıldı`), `OWN_STATUSES`, `OWN_STATUS_TONE`, `SELLABLE` (`evet: "Satılabilir", belki: "Belki satılır", hayir: "Satılmaz"`), `SELLABLE_TONE`, `PRIORITY` (`Yüksek, Orta, Düşük`), `PRIORITIES`, `PRIORITY_TONE`; record type label `own_project: "Kendi projesi"` next to `idea: "Fikir"`.
- `components/icons.tsx`: add `cube: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>`.
- Comments page and any target type → path map: `own_project` → `/projelerim/:id`.

### 6.2 Navigation

- `app/routes.ts`: loader `ownProjects: () => import("../pages/OwnProjects")`, `PATHS.ownProjects = "/projelerim"`.
- `app/App.tsx`: `<Route path={`${PATHS.ownProjects}/:id?`} component={pages.ownProjects} />` next to ideas.
- `app/Sidebar.tsx`: `marketing` ideas label → `"Para fikirleri"`; `second` becomes pipeline, projects (label `"Müşteri projeleri"`), `{ key: "ownProjects", label: "Kendi projelerim", icon: "cube" }`, timeline, report.

### 6.3 Shared sector picker

Move `SectorPicker` from `forms/ContactForms.tsx` to `components/SectorPicker.tsx` (export it, no behaviour change); `ContactForms.tsx` imports it. The own project form uses it.

### 6.4 Own project form (`forms/OwnProjectForm.tsx`, new)

Sheet kind `"own_project"`: add to `SheetKind` in `app/ui.ts`, sheet context gains `own_project_id?: number`, lazy import + switch case in `forms/QuickAdd.tsx` like `ProjectForm`. Edit mode when `own_project_id` is given (loads `/own-projects/:id`).

Fields in order:

1. **Ad** (required).
2. **Ne yapıyor** (textarea → `description`).
3. **Durum**: `Segmented` with the four statuses.
4. **Satılabilir mi**: `Segmented` Evet / Belki / Hayır, then input **Kime, nasıl satılabilir** (`sellable_note`, shown for evet and belki).
5. **Uygun sektörler**: `SectorPicker` (sends `sector_ids` and new names as `sectors`, same as contact forms).
6. **Notlar** (textarea).

Save: POST or PATCH, ok toast `Proje kaydedildi`; after create navigate to `/projelerim/<id>`.

### 6.5 Idea form changes (`forms/MarketingForms.tsx > IdeaForm`)

- New first field **Nerede** (select): `Para kazanma fikirleri` (value `""`) plus every own project not `birakildi`, by name. Default: sheet context `own_project_id`, else the idea's current value.
- When a project is chosen: show **Öncelik** (`Segmented` Yüksek / Orta / Düşük, default Orta); hide Aşama, Hedef sektörler and the parent field; payload `{ title, problem, notes, own_project_id, priority }`.
- When general: current fields; the parent field label becomes **Üst fikir (isteğe bağlı)** and its options exclude ideas that have `own_project_id`; payload sends `own_project_id: null` only when editing an idea that was in a project.
- The **Çözdüğü sorun** label reads **Açıklama** when a project is chosen.

### 6.6 Para kazanma fikirleri (`pages/Ideas.tsx`)

- Title `Para kazanma fikirleri`; work only on `ideas.rows.filter((i) => !i.own_project_id)` (list, counts, sub line).
- If the selected `:id` is a project idea, `navigate(`${PATHS.ownProjects}/${i.own_project_id}`, { replace: true })`.
- `IdeaCard` header: for a top level idea (`!i.parent_id`) add `btn btn-ghost btn-sm` **Projeye dönüştür** → `run("post", `/own-projects/from-idea/${i.id}`, {}, { ok: "Proje açıldı" })`, then navigate to `/projelerim/<row.id>`. No confirm dialog: the source idea is restorable from trash, and the effects toast says so.
- The `Proje: <parent_title>` link text becomes `Üst fikir: <parent_title>`.

### 6.7 Kendi projelerim page (`pages/OwnProjects.tsx` + `components/ProjectIdeas.tsx`, both new, each under 700 lines)

Page:

- `Page` title `Kendi projelerim`, sub `${aktif} aktif · ${sum(open_ideas)} açık fikir`, right `btn btn-pri` **Proje ekle** → `openSheet("own_project")`.
- `Filters` label `Durum`: Hepsi + four statuses.
- Desktop (`useIsDesktop()`): same grid as Ideas (`grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-9`); list left, `OwnProjectCard` right; first project selected when no `:id`.
- Mobile: without `:id` only the list; with `:id` only the card, topped by a `Link` **← Kendi projelerim** to `/projelerim`. Row tap navigates (not replace) so the back gesture returns to the list.
- List row (`row cv-auto` like Ideas): line 1 name, status chip, sellable chip, `Who`; line 2 `text-base-sm text-text-secondary`: `${open_ideas} açık fikir · ${done_ideas} yapıldı · sectors`.
- Empty state: `Henüz kendi projen yok. Kendi ürününü ekle; satılabilir mi, hangi sektöre uyar, sıradaki fikirler neler, burada dursun.`

`OwnProjectCard` (data: `useQuery<Detail<OwnProject, { ideas: Idea[]; comments: Thread[] }>>(`/own-projects/${id}?with=ideas,comments`)`):

1. Header row: name (`h2`), status chip, `Who`, spacer, **Düzenle** (`openSheet("own_project", { own_project_id })`), **Sil** (danger ghost, `remove(`/own-projects/${id}`, `“${name}” projesi`)`).
2. Description paragraph, or muted `Ne yaptığı yazılmadı`.
3. `inset` block: sellable chip + `sellable_note`; sector chips (`tone="source"`) under it.
4. Status `radiogroup` of `fchip` buttons (same as idea stages) → `PATCH {status}`.
5. `ProjectIdeas` (below).
6. `LinksCard type="own_project"` (widen its `type` prop union).
7. `Comments` from `components/contact.tsx` with `target={{ type: "own_project", id, label: name }}`.
8. Notes in `inset` if present.

`ProjectIdeas({ projectId, ideas })`:

- Quick add row: input `Fikir ekle` (Enter submits) + small select for priority (default Orta) + `btn btn-sec` **Ekle** → `POST /ideas {title, own_project_id, priority}`; input clears and keeps focus.
- Three sections in `PRIORITIES` order, header `h3` `Yüksek · 3`. Desktop shows empty groups as a muted drop zone `Buraya sürükle`; mobile hides empty groups.
- Row: drag handle (desktop only, `ibtn` with `Icon name="menu"`, `aria-label="Sırala"`), check `ibtn` (`Icon name="check"`, `aria-label="Yapıldı"`) → `PATCH {done:true}`, title (truncate) with `problem` as a muted second line, `Who`. Tapping the text opens `openSheet("idea", { idea_id })`.
- Desktop drag: `DndContext` with `PointerSensor`, `KeyboardSensor` (`sortableKeyboardCoordinates`), `closestCorners`; one `SortableContext` (`verticalListSortingStrategy`) per priority group, group containers `useDroppable` with id `group:<priority>`, `DragOverlay` showing the row. On drop compute target priority and index in that group without the dragged id, optimistic `mutate` of the detail query, then `PATCH /ideas/:id {priority, position}`; on error restore the previous value. Copy the structure of `pages/Pipeline.tsx` (sensors, `lastDragEnd` click guard).
- Mobile: no drag. Each row gets two `ibtn`: **Yukarı** / **Aşağı** (`Icon name="arrow"` with `-rotate-90` / `rotate-90`), disabled at group edges → `PATCH {position: index ∓ 1}`. Priority is changed in the idea sheet.
- `Yapılanlar (n)` toggle button below the groups (closed by default); done rows: `line-through text-text-muted`, `ibtn` **Geri al** → `PATCH {done:false}`.
- Empty project: `Bu projede fikir yok. Aklına geleni yukarıdan ekle; sürükleyerek sırala.`

## 7. Docs

- `docs/MIMARI.md`: §2.17 Fikirler gets the scope/priority fields; new section `## 13. Kendi projelerim (2026-10-10)` with a short summary of §1 to §6 of this plan and a link to this file; §6 test list 20 to 23.
- `CLAUDE.md` needs no change.

## 8. Out of scope

Dashboard/today entries, global search, reports, Fab entry, interest measurement on own projects, money tracking for own products. Add later only if Özgür asks.

## 9. Steps and commit points

Run `npm test` before every commit; it must be green. Commit messages are lowercase imperative with a type prefix, like the history (`feat: ...`).

1. **Schema + migration** (§2). Commit `feat: own projects table and idea scope, priority and order columns`. Check: migration file content as in §2.3, migration on a DB copy keeps 8 ideas.
2. **Shared helpers refactor** (§3.1). Commit `refactor: share group reorder, sector link and sector filter helpers`. Check: all old tests green, pipeline drag still orders cards (quick manual check).
3. **Core rules and service** (§3.2 to §3.4) **with tests 20 to 23** (§3.5). Commit `feat: own projects service and project scoped ideas with priority order`. Check: `npm test` shows the four new tests passing.
4. **REST** (§4). Commit `feat: own projects REST endpoints`. Check: `npm start`, then `curl localhost:<port>/api/own-projects` returns `{rows:[],total:0}` (with the auth the app uses).
5. **MCP** (§5). Commit `feat: own projects in MCP find, get, save, move`. Check: build, then through the MCP `find own_project` and `save own_project {name:"Deneme"}` + `delete own_project Deneme` work and the output lines are one line each.
6. **Web data, navigation, forms** (§6.1 to §6.5). Commit `feat: own project form, idea scope field, sidebar and routes`.
7. **Web pages** (§6.6, §6.7). Commit `feat: kendi projelerim page with priority ordered ideas`. Check manually at desktop and 375 px width: create a project, add ideas, drag between groups (desktop), up/down (mobile), mark done and undo, move an idea to general and back via the form, delete and restore the project from trash.
8. **Docs** (§7). Commit `docs: describe own projects`.
9. **Data step** (live DB, reversible): through the MCP call `save own_project {from_idea:"Full Follow"}`, then `save own_project {sellable:"belki", sellable_note:"Freelancer ve küçük ajanslara kişisel CRM olarak"}` on the new id, and `save idea {own_project:"Full Follow"}` for "Proje takip sistemi (kendi projelerim)" if it is not already inside. Report the result to Özgür. No commit.

## 10. Acceptance checklist

- [ ] General ideas page is titled "Para kazanma fikirleri" and shows no project ideas.
- [ ] "Kendi projelerim" lists own products with status, sellable and sector chips; client project numbers and reports are unchanged.
- [ ] Project ideas are grouped Yüksek / Orta / Düşük; drag order and priority changes persist after reload.
- [ ] An idea moves general ↔ project through the form; R1 and R5 errors appear as toasts.
- [ ] "Projeye dönüştür" on Full Follow moves its three ideas and puts the source idea in trash.
- [ ] Deleting an own project returns its ideas to the general list; restoring re-links them.
- [ ] MCP `find own_project`, `get own_project <ad> with ideas`, `save idea {own_project, priority}` work with one line per record.
- [ ] `npm test` green, tests 20 to 23 present; no file over 700 lines; no literal colours or sizes added in web files.
