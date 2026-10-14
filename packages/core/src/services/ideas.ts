import { eq } from "drizzle-orm";
import { IDEA_STAGES, label } from "../constants";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { idea_people, idea_sectors, ideas } from "../db/schema";
import { ideaCreate, ideaUpdate, interestSave, interestUpdate } from "../schemas";
import { sectorInput, setSectorLinks } from "./sectors";
import { placeInGroup, renumberGroup, requireRow, truncate } from "./shared";
import { announceTrashed, Bin } from "./trash";

/**
 * Kişiyi fikre bağlar (yoksa "anlatıldı" olarak). Fikir hakkındaki temas da bunu çağırır.
 * Var olan bağda ilgi seviyesi verilmişse güncellenir.
 */
export function upsertInterest(q: Q, ctx: Ctx, d: { idea_id: number; person_id: number; interest?: (typeof idea_people.$inferSelect)["interest"]; note?: string | null; touch_id?: number | null }) {
  const idea = requireRow(ctx, "ideas", d.idea_id);
  const person = requireRow(ctx, "people", d.person_id);
  const cur = row(ctx, "SELECT * FROM idea_people WHERE idea_id = ? AND person_id = ?", d.idea_id, d.person_id);
  if (!cur) {
    const r = q.insert(idea_people).values({
      idea_id: d.idea_id, person_id: d.person_id, interest: d.interest ?? "anlatildi", note: d.note ?? null, touch_id: d.touch_id ?? null, ...stamp(ctx),
    }).returning().get();
    emit(q, ctx, { type: "idea.told", person_id: person.id, summary: `Fikir anlatıldı: ${truncate(idea.title, 50)}${d.interest && d.interest !== "anlatildi" ? ` (${label(d.interest)})` : ""}`, data: { idea_id: idea.id } });
    return { row: r, effects: [`${person.name} fikre bağlandı`] };
  }
  const set: Record<string, unknown> = {};
  if (d.interest && d.interest !== cur.interest) set.interest = d.interest;
  if (d.note !== undefined && d.note !== cur.note) set.note = d.note;
  if (d.touch_id && !cur.touch_id) set.touch_id = d.touch_id;
  if (Object.keys(set).length) {
    q.update(idea_people).set({ ...set, updated_at: ctx.clock.now() }).where(eq(idea_people.id, cur.id)).run();
    if (set.interest) emit(q, ctx, { type: "idea.interest", person_id: person.id, summary: `Fikre ilgi: ${truncate(idea.title, 50)} → ${label(String(set.interest))}`, data: { idea_id: idea.id } });
  }
  return { row: requireRow(ctx, "idea_people", cur.id), effects: [] as string[] };
}

/** Fikir listesi + ilgi ölçümü: kaç kişiye anlatıldı, kaçı ilgilendi, oran; hedef sektörler; temas ve paylaşım sayısı */
export function ideaStats(ctx: Ctx) {
  const secs = rows<{ idea_id: number; id: number; path: string }>(ctx, `
    SELECT x.idea_id, s.id, CASE WHEN p.name IS NULL THEN s.name ELSE p.name || ' > ' || s.name END AS path
    FROM idea_sectors x JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY path`);
  return rows(ctx, `
    SELECT i.*,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id) AS told,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id AND x.interest = 'ilgilendi') AS interested,
      (SELECT COUNT(*) FROM idea_people x WHERE x.idea_id = i.id AND x.interest = 'ilgilenmedi') AS not_interested,
      (SELECT COUNT(*) FROM touches t WHERE t.idea_id = i.id) AS touch_count,
      (SELECT COUNT(*) FROM posts p WHERE p.idea_id = i.id) AS post_count,
      (SELECT COUNT(*) FROM people x JOIN posts p ON p.id = x.post_id WHERE p.idea_id = i.id) AS post_people,
      (SELECT title FROM ideas pa WHERE pa.id = i.parent_id) AS parent_title,
      (SELECT name FROM own_projects o WHERE o.id = i.own_project_id) AS own_project_title,
      (SELECT COUNT(*) FROM ideas c WHERE c.parent_id = i.id) AS child_count
    FROM ideas i ORDER BY i.updated_at DESC, i.id DESC`)
    .map((i) => {
      const s = secs.filter((x) => x.idea_id === i.id);
      return { ...i, sectors: s.map((x) => ({ id: x.id, path: x.path })), interest_rate: i.told ? i.interested / i.told : null };
    })
    .sort((a, b) => IDEA_STAGES.indexOf(b.stage) - IDEA_STAGES.indexOf(a.stage) || b.updated_at.localeCompare(a.updated_at));
}

/** Bir fikre bağlı kişiler (ilgisiyle) */
export function ideaPeople(ctx: Ctx, ideaId?: number, personId?: number) {
  return rows(ctx, `
    SELECT x.*, p.name AS person_name, c.name AS company_name, i.title AS idea_title, i.stage AS idea_stage
    FROM idea_people x JOIN people p ON p.id = x.person_id JOIN ideas i ON i.id = x.idea_id LEFT JOIN companies c ON c.id = p.company_id
    WHERE (? IS NULL OR x.idea_id = ?) AND (? IS NULL OR x.person_id = ?)
    ORDER BY CASE x.interest WHEN 'ilgilendi' THEN 0 WHEN 'anlatildi' THEN 1 ELSE 2 END, x.updated_at DESC`,
    ideaId ?? null, ideaId ?? null, personId ?? null, personId ?? null);
}

/** Bağlı kişi ve sektör satırları gider; temas ve paylaşımlar kalır, fikir bağı kopar */
export function trashIdea(tx: Q, ctx: Ctx, id: number) {
  const cur = requireRow(ctx, "ideas", id);
  const bin = new Bin(ctx);
  // touches about the idea are the network module's to unlink
  announceTrashed(ctx, bin, "idea", id);
  bin.unlink("posts", "idea_id", id);
  bin.unlink("ideas", "parent_id", id);
  bin.take("idea_people", "idea_id = ?", id);
  bin.take("idea_sectors", "idea_id = ?", id);
  bin.take("comments", "target_type = 'idea' AND target_id = ?", id);
  bin.take("ideas", "id = ?", id);
  bin.commit(tx, "idea", id, cur.title);
  emit(tx, ctx, { type: "idea.deleted", summary: `Fikir silindi: ${truncate(cur.title, 60)}` });
  return { effects: [] as string[], trash: { type: "idea", id } };
}

export function ideasService(ctx: Ctx) {
  /** Two levels only: the parent is a top-level idea, and an idea with children cannot get a parent */
  function checkParent(parentId: number | null | undefined, selfId?: number) {
    if (!parentId) return;
    if (parentId === selfId) throw new FFError("validation", "fikir kendi altına konamaz");
    const p = requireRow(ctx, "ideas", parentId, "üst fikir");
    if (p.own_project_id) throw new FFError("validation", "proje fikri üst fikir olamaz");
    if (p.parent_id) throw new FFError("validation", `${p.title} zaten bir alt fikir; alt fikrin altına fikir konmaz`);
    if (selfId && row(ctx, "SELECT 1 x FROM ideas WHERE parent_id = ?", selfId)) throw new FFError("validation", "alt fikirleri olan bir fikir başka bir fikrin altına konamaz");
  }

  /** Priority group of a project idea (done ideas sit outside the groups) */
  const GROUP = "own_project_id = ? AND priority = ? AND done_at IS NULL";

  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ideaCreate, sectorInput(tx, ctx, input));
      if (d.own_project_id) {
        if (d.parent_id) throw new FFError("validation", "proje fikri bir üst fikrin altına konamaz");
        requireRow(ctx, "own_projects", d.own_project_id, "kendi projesi");
      } else if (d.priority) {
        throw new FFError("validation", "öncelik, sıra ve yapıldı sadece proje fikirlerinde");
      }
      checkParent(d.parent_id);
      const r = tx.insert(ideas).values({ ...d, ...stamp(ctx) }).returning().get();
      if (r.own_project_id) placeInGroup(tx, ctx, "ideas", GROUP, [r.own_project_id, r.priority], r.id);
      if (sector_ids?.length) setSectorLinks(tx, ctx, "idea", r.id, sector_ids);
      emit(tx, ctx, { type: "idea.created", summary: `Fikir: ${truncate(d.title, 60)}`, data: { idea_id: r.id } });
      return { row: requireRow(ctx, "ideas", r.id), effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, done, ...d } = parse(ideaUpdate, sectorInput(tx, ctx, input));
      const cur = requireRow(ctx, "ideas", id);
      const projectId = d.own_project_id !== undefined ? d.own_project_id : cur.own_project_id;
      if ((d.priority !== undefined || d.position !== undefined || done !== undefined) && !projectId) {
        throw new FFError("validation", "öncelik, sıra ve yapıldı sadece proje fikirlerinde");
      }
      if (projectId) {
        if (d.parent_id) throw new FFError("validation", "proje fikri bir üst fikrin altına konamaz");
        if (row(ctx, "SELECT 1 x FROM ideas WHERE parent_id = ?", id)) throw new FFError("validation", "alt fikirleri olan fikir projeye taşınamaz; önce alt fikirleri ayır");
        requireRow(ctx, "own_projects", projectId, "kendi projesi");
        d.parent_id = null;
      }
      checkParent(d.parent_id, id);

      const now = ctx.clock.now();
      const wasDone = !!cur.done_at;
      const isDone = done !== undefined ? done : wasDone;
      const set: Record<string, unknown> = { ...d };
      if (done !== undefined) set.done_at = done ? now : null;
      const scopeChanged = d.own_project_id !== undefined && d.own_project_id !== cur.own_project_id;
      if (scopeChanged && !projectId) { set.done_at = null; set.position = 0; }

      const priority = d.priority ?? cur.priority;
      const reorder = scopeChanged || (d.priority !== undefined && d.priority !== cur.priority) || d.position !== undefined || (done !== undefined && done !== wasDone);
      if (Object.keys(set).length || sector_ids) tx.update(ideas).set({ ...set, updated_at: now }).where(eq(ideas.id, id)).run();

      if (reorder) {
        if (cur.own_project_id && !wasDone) renumberGroup(tx, ctx, "ideas", GROUP, [cur.own_project_id, cur.priority]);
        if (projectId && !isDone) {
          const pos = d.position !== undefined ? d.position : undefined;
          placeInGroup(tx, ctx, "ideas", GROUP, [projectId, priority], id, pos);
        }
      }
      if (sector_ids) setSectorLinks(tx, ctx, "idea", id, sector_ids);

      const effects: string[] = [];
      const title = truncate(d.title ?? cur.title, 50);
      if (scopeChanged) {
        const name = projectId ? requireRow(ctx, "own_projects", projectId).name : "Para kazanma fikirleri";
        emit(tx, ctx, { type: "idea.moved", summary: `Fikir taşındı: ${title} → ${name}`, data: { idea_id: id, from: cur.own_project_id, to: projectId } });
        effects.push(`fikir → ${name}`);
      } else if (done !== undefined && done !== wasDone) {
        emit(tx, ctx, { type: done ? "idea.done" : "idea.undone", summary: done ? `Fikir yapıldı: ${title}` : `Fikir geri açıldı: ${title}`, data: { idea_id: id } });
      } else if (d.stage && d.stage !== cur.stage) {
        emit(tx, ctx, { type: "idea.stage", summary: `Fikir ${label(cur.stage)} → ${label(d.stage)}: ${truncate(cur.title, 50)}`, data: { idea_id: id, from: cur.stage, to: d.stage } });
        effects.push(`fikir → ${label(d.stage)}`);
      } else if (Object.keys(set).length || sector_ids) {
        emit(tx, ctx, { type: "idea.updated", summary: `Fikir düzenlendi: ${truncate(d.title ?? cur.title, 60)}`, data: { idea_id: id } });
      }
      return { row: requireRow(ctx, "ideas", id), effects };
    });
  }

  const move = (id: number, stage: string) => {
    if (!(IDEA_STAGES as readonly string[]).includes(stage)) throw new FFError("validation", `fikir aşaması: ${IDEA_STAGES.join(", ")}`);
    return update(id, { stage });
  };

  function remove(id: number) {
    return ctx.db.transaction((tx) => trashIdea(tx, ctx, id));
  }

  // ---- ilgi (fikir ↔ kişi) ----
  function saveInterest(input: unknown) {
    const d = parse(interestSave, input);
    return ctx.db.transaction((tx) => upsertInterest(tx, ctx, d));
  }
  function updateInterest(id: number, input: unknown) {
    const d = parse(interestUpdate, input);
    const cur = requireRow(ctx, "idea_people", id);
    return ctx.db.transaction((tx) => upsertInterest(tx, ctx, { idea_id: cur.idea_id, person_id: cur.person_id, interest: d.interest, note: d.note }));
  }
  function removeInterest(id: number) {
    const cur = requireRow(ctx, "idea_people", id);
    const idea = requireRow(ctx, "ideas", cur.idea_id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("idea_people", "id = ?", id);
      bin.commit(tx, "interest", id, `Fikir ilgisi: ${truncate(idea.title, 50)}`);
      emit(tx, ctx, { type: "idea.untold", person_id: cur.person_id, summary: `Fikir bağı kaldırıldı: ${truncate(idea.title, 50)}` });
      return { effects: [] as string[], trash: { type: "interest", id } };
    });
  }

  return { create, update, move, remove, saveInterest, updateInterest, removeInterest };
}
