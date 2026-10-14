import { eq } from "drizzle-orm";
import {
  announceTrashed, Bin, FFError, IDEA_STAGES, keptRow, keptRows, label, parse, placeInGroup, renumberGroup, requireRow, schema, sectorInput, setSectorLinks, stamp,
  truncate, writeEvent as emit, type Ctx, type IdeaRecord, type InterestLevel, type InterestRecord, type OwnProjectRecord, type Q,
} from "@fullfollow/core";
import { ideaCreate, ideaUpdate, interestSave, interestUpdate } from "./schemas";

/** The table that links ideas to sectors */
const SECTOR_LINKS = { table: "idea_sectors", owner: "idea_id" };

const { idea_people, ideas } = schema;

/**
 * Kişiyi fikre bağlar (yoksa "anlatıldı" olarak). Fikir hakkındaki temas da bunu çağırır.
 * Var olan bağda ilgi seviyesi verilmişse güncellenir.
 */
export function upsertInterest(q: Q, ctx: Ctx, d: { idea_id: number; person_id: number; interest?: InterestLevel; note?: string | null; touch_id?: number | null }) {
  const idea = requireRow(ctx, "ideas", d.idea_id);
  const person = requireRow(ctx, "people", d.person_id);
  const cur = keptRow(ctx, "SELECT * FROM idea_people WHERE idea_id = ? AND person_id = ?", d.idea_id, d.person_id);
  if (!cur) {
    const r = q.insert(idea_people).values({
      idea_id: d.idea_id, person_id: d.person_id, interest: d.interest ?? "anlatildi", note: d.note ?? null, touch_id: d.touch_id ?? null, ...stamp(ctx),
    }).returning().get();
    emit(q, ctx, { type: "idea.told", person_id: person.id, summary: `Fikir anlatıldı: ${truncate(idea.title, 50)}${d.interest && d.interest !== "anlatildi" ? ` (${label(d.interest)})` : ""}`, data: { idea_id: idea.id } });
    return { row: r as InterestRecord, effects: [`${person.name} fikre bağlandı`] };
  }
  const set: Record<string, unknown> = {};
  if (d.interest && d.interest !== cur.interest) set.interest = d.interest;
  if (d.note !== undefined && d.note !== cur.note) set.note = d.note;
  if (d.touch_id && !cur.touch_id) set.touch_id = d.touch_id;
  if (Object.keys(set).length) {
    q.update(idea_people).set({ ...set, updated_at: ctx.clock.now() }).where(eq(idea_people.id, cur.id)).run();
    if (set.interest) emit(q, ctx, { type: "idea.interest", person_id: person.id, summary: `Fikre ilgi: ${truncate(idea.title, 50)} → ${label(String(set.interest))}`, data: { idea_id: idea.id } });
  }
  return { row: requireRow<InterestRecord>(ctx, "idea_people", cur.id), effects: [] as string[] };
}

/** Bağlı kişi ve sektör satırları gider; temas ve paylaşımlar kalır, fikir bağı kopar (touches and posts unlink themselves when they hear the announcement) */
export function trashIdea(tx: Q, ctx: Ctx, id: number) {
  const cur = requireRow(ctx, "ideas", id);
  const bin = new Bin(ctx);
  announceTrashed(ctx, bin, "idea", id);
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
    if (selfId && keptRow(ctx, "SELECT 1 x FROM ideas WHERE parent_id = ?", selfId)) throw new FFError("validation", "alt fikirleri olan bir fikir başka bir fikrin altına konamaz");
  }

  /** An own project is the own-projects module's: a project given to an idea must exist there */
  function projectOf(id: number): OwnProjectRecord {
    const projects = ctx.mod("own-projects");
    if (!projects) throw new FFError("validation", `kendi projesi verildi (#${id}) ama "own-projects" modülü kurulu değil`);
    const p = projects.ref(id);
    if (!p) throw new FFError("not_found", `kendi projesi #${id} bulunamadı`);
    return p;
  }

  /** Priority group of a project idea (done ideas sit outside the groups) */
  const GROUP = "own_project_id = ? AND priority = ? AND done_at IS NULL";

  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { sector_ids, ...d } = parse(ideaCreate, sectorInput(tx, ctx, input));
      if (d.own_project_id) {
        if (d.parent_id) throw new FFError("validation", "proje fikri bir üst fikrin altına konamaz");
        projectOf(d.own_project_id);
      } else if (d.priority) {
        throw new FFError("validation", "öncelik, sıra ve yapıldı sadece proje fikirlerinde");
      }
      checkParent(d.parent_id);
      const r = tx.insert(ideas).values({ ...d, ...stamp(ctx) }).returning().get();
      if (r.own_project_id) placeInGroup(tx, ctx, "ideas", GROUP, [r.own_project_id, r.priority], r.id);
      if (sector_ids?.length) setSectorLinks(ctx, SECTOR_LINKS, r.id, sector_ids);
      emit(tx, ctx, { type: "idea.created", summary: `Fikir: ${truncate(d.title, 60)}`, data: { idea_id: r.id } });
      return { row: requireRow<IdeaRecord>(ctx, "ideas", r.id), effects: [] as string[] };
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
        if (keptRow(ctx, "SELECT 1 x FROM ideas WHERE parent_id = ?", id)) throw new FFError("validation", "alt fikirleri olan fikir projeye taşınamaz; önce alt fikirleri ayır");
        // a project the idea already belongs to exists (deleting a project lets its ideas go), so only a new one is looked up
        if (d.own_project_id !== undefined) projectOf(projectId);
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
      if (sector_ids) setSectorLinks(ctx, SECTOR_LINKS, id, sector_ids);

      const effects: string[] = [];
      const title = truncate(d.title ?? cur.title, 50);
      if (scopeChanged) {
        const name = projectId ? projectOf(projectId).name : "Para kazanma fikirleri";
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
      return { row: requireRow<IdeaRecord>(ctx, "ideas", id), effects };
    });
  }

  const move = (id: number, stage: string) => {
    if (!(IDEA_STAGES as readonly string[]).includes(stage)) throw new FFError("validation", `fikir aşaması: ${IDEA_STAGES.join(", ")}`);
    return update(id, { stage });
  };

  function remove(id: number) {
    return ctx.db.transaction((tx) => trashIdea(tx, ctx, id));
  }

  /** An own project takes the idea over: its sub ideas move into the project (first ones first), then the idea goes to the trash */
  function handOver(tx: Q, ideaId: number, projectId: number): number {
    const now = ctx.clock.now();
    const kids = keptRows<{ id: number }>(ctx, "SELECT id FROM ideas WHERE parent_id = ? ORDER BY id", ideaId);
    const move = ctx.sqlite.prepare("UPDATE ideas SET parent_id = NULL, own_project_id = ?, priority = 'orta', position = ?, updated_at = ? WHERE id = ?");
    kids.forEach((k, i) => move.run(projectId, i, now, k.id));
    trashIdea(tx, ctx, ideaId);
    return kids.length;
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

  return { create, update, move, remove, handOver, saveInterest, updateInterest, removeInterest };
}
