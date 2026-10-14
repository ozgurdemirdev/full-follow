import { FFError, keptRows, normalizeType, resolveId, type Ctx, type TimelineEvent } from "@fullfollow/core";

const BY_PERSON = "SELECT * FROM events WHERE person_id = ? ORDER BY id DESC LIMIT ?";
const BY_OPPORTUNITY = "SELECT * FROM events WHERE opportunity_id = ? ORDER BY id DESC LIMIT ?";
const BY_PROJECT = "SELECT * FROM events WHERE project_id = ? ORDER BY id DESC LIMIT ?";

/** Kişi / fırsat / proje olayları: son N olay, eskiden yeniye */
export function timelineOf(ctx: Ctx, type: string, id: string | number, limit: number): TimelineEvent[] {
  const t = normalizeType(ctx, type);
  if (t !== "person" && t !== "opportunity" && t !== "project") throw new FFError("validation", "timeline için person, opportunity ya da project");
  const sql = t === "person" ? BY_PERSON : t === "opportunity" ? BY_OPPORTUNITY : BY_PROJECT;
  const list = keptRows(ctx, sql, resolveId(ctx, t, id), limit).reverse();
  return list.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null }));
}
