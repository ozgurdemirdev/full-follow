import { eq } from "drizzle-orm";
import {
  Bin, ensureSector, FFError, keptRow, parse, renderTemplate, requireRow, schema, stamp, subjectInfo, truncate, writeEvent as emit,
  type Ctx, type Q, type Subject, type TemplateRecord,
} from "@fullfollow/core";
import { m } from "../messages";
import { EVENT_NAME_LENGTH } from "./constants";
import { templateCreate, templateUpdate } from "./schemas";
import { suggestTemplates } from "./stats";

const { templates } = schema;

/** Girdideki `sector` ("Sağlık > Diş hekimi") → sector_id */
function withSector(q: Q, ctx: Ctx, input: unknown): unknown {
  if (!input || typeof input !== "object" || !("sector" in input)) return input;
  const { sector, ...rest } = input as Record<string, any>;
  return rest.sector_id !== undefined ? rest : { ...rest, sector_id: ensureSector(q, ctx, sector ?? null) };
}

/** The stored row of one template */
export const templateRef = (ctx: Ctx, id: number): TemplateRecord | undefined => keptRow<TemplateRecord>(ctx, "SELECT * FROM templates WHERE id = ?", id);

export function templatesService(ctx: Ctx) {
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const d = parse(templateCreate, withSector(tx, ctx, input));
      if (d.sector_id) requireRow(ctx, "sectors", d.sector_id, m.sector);
      const r = tx.insert(templates).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "template.created", summary: m.event.created(truncate(d.name, EVENT_NAME_LENGTH)), data: { template_id: r.id } });
      return { row: r as TemplateRecord, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const d = parse(templateUpdate, withSector(tx, ctx, input));
      const cur = requireRow(ctx, "templates", id);
      if (d.sector_id) requireRow(ctx, "sectors", d.sector_id, m.sector);
      if (Object.keys(d).length) {
        tx.update(templates).set({ ...d, updated_at: ctx.clock.now() }).where(eq(templates.id, id)).run();
        emit(tx, ctx, { type: "template.updated", summary: m.event.updated(truncate(d.name ?? cur.name, EVENT_NAME_LENGTH)), data: { template_id: id } });
      }
      return { row: requireRow<TemplateRecord>(ctx, "templates", id), effects: [] as string[] };
    });
  }

  /** Taslaklar kalır, sadece şablon bağı kopar */
  function remove(id: number) {
    const cur = requireRow(ctx, "templates", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("drafts", "template_id", id);
      bin.take("templates", "id = ?", id);
      bin.commit(tx, "template", id, cur.name);
      emit(tx, ctx, { type: "template.deleted", summary: m.event.deleted(truncate(cur.name, EVENT_NAME_LENGTH)) });
      return { effects: [] as string[], trash: { type: "template", id } };
    });
  }

  /** Şablonu kişiye ya da firmaya uygular (önizleme) */
  function render(id: number, subject: Subject) {
    const t = requireRow<TemplateRecord>(ctx, "templates", id);
    if (!subjectInfo(ctx, subject)) throw new FFError("validation", m.needSubject);
    return { body: renderTemplate(ctx, t.body, subject), template: t };
  }

  const suggest = (subject: Subject, channel?: string | null, kind?: string | null) => {
    if (!subject.person_id && !subject.company_id && !subject.contact) throw new FFError("validation", m.needSubject);
    return suggestTemplates(ctx, subject, channel, kind);
  };

  return { create, update, remove, render, suggest };
}
