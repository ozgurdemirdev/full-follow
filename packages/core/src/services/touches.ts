import { eq } from "drizzle-orm";
import { emit, parse, rows, stamp, FFError, type Ctx } from "../context";
import type { Q } from "../db/client";
import { touches } from "../db/schema";
import { touchCreate } from "../schemas";
import { applyStage } from "./opportunities";
import { link, requireRow, truncate } from "./shared";
import { z } from "zod";

type TouchInput = z.infer<typeof touchCreate> & { draft_id?: number };

/**
 * Temas kaydeder ve fırsat aşamasını ilerletir:
 * bulundu + giden → temas, temas + gelen → cevap. Daha ileri aşamalara dokunmaz.
 * Fırsat verilmediyse kişinin tek açık fırsatı varsa ona bağlanır.
 */
export function insertTouch(q: Q, ctx: Ctx, d: TouchInput) {
  requireRow(ctx, "people", d.person_id);
  let oppId = d.opportunity_id ?? null;
  if (oppId) {
    const o = requireRow(ctx, "opportunities", oppId);
    if (o.person_id !== d.person_id) throw new FFError("validation", `fırsat #${oppId} bu kişiye ait değil`);
  } else if (!d.project_id) {
    // proje hakkındaki temas satış fırsatını ilerletmesin; sadece serbest temas tek açık fırsata bağlanır
    const open = rows<{ id: number }>(ctx, "SELECT id FROM opportunities WHERE person_id = ? AND stage IN ('bulundu','temas','cevap','gorusme','teklif')", d.person_id);
    if (open.length === 1) oppId = open[0].id;
  }
  if (d.project_id) {
    const p = requireRow(ctx, "projects", d.project_id);
    if (p.person_id !== d.person_id) throw new FFError("validation", `proje #${d.project_id} bu kişiye ait değil`);
  }

  const r = q.insert(touches).values({
    person_id: d.person_id, opportunity_id: oppId, project_id: d.project_id ?? null,
    channel: d.channel, direction: d.direction, kind: d.kind, summary: d.summary, outcome: d.outcome ?? null,
    happened_at: d.happened_at ?? ctx.clock.now(), draft_id: d.draft_id ?? null, ...stamp(ctx),
  }).returning().get();
  emit(q, ctx, {
    type: "touch.created", ...link(ctx, { person_id: d.person_id, opportunity_id: oppId, project_id: d.project_id }),
    summary: `${d.direction === "giden" ? "Giden" : "Gelen"} ${d.kind} (${d.channel}): ${truncate(d.summary, 60)}`,
    data: { touch_id: r.id, channel: d.channel, direction: d.direction },
  });

  const effects: string[] = [];
  if (oppId) {
    const o = requireRow(ctx, "opportunities", oppId);
    const next = o.stage === "bulundu" && d.direction === "giden" ? "temas" : o.stage === "temas" && d.direction === "gelen" ? "cevap" : null;
    if (next) {
      applyStage(q, ctx, o, next, { auto: true });
      effects.push(`fırsat #${oppId} → ${next}`);
    }
  }
  return { row: r, effects };
}

export function touchesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(touchCreate, input);
    return ctx.db.transaction((tx) => insertTouch(tx, ctx, d));
  }
  function remove(id: number) {
    const cur = requireRow(ctx, "touches", id);
    ctx.db.transaction((tx) => {
      tx.delete(touches).where(eq(touches.id, id)).run();
      emit(tx, ctx, { type: "touch.deleted", ...link(ctx, cur), summary: `Temas silindi: ${truncate(cur.summary, 60)}`, data: { touch_id: id } });
    });
    return { effects: [] as string[] };
  }
  return { create, remove };
}
