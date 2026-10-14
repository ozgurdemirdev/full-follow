import { has, keptRow, page, resolveRef, sectorMatch, type Ctx, type IdeaRecord, type IdeaStats, type InterestRow, type ListOpts } from "@fullfollow/core";
import { ideaPeople, ideaStats } from "./stats";

/** Filters: stage, sector (the sector and its sub sectors), own_project (name or id), general; q searches title, problem and notes */
export function ideaList(ctx: Ctx, o: ListOpts): { rows: IdeaStats[]; total: number } {
  const f = o.filter ?? {};
  let list = ideaStats(ctx);
  if (f.stage) list = list.filter((i) => i.stage === f.stage);
  if (f.sector) {
    const ids = sectorMatch(ctx, f.sector);
    list = list.filter((i) => i.sectors.some((s) => ids.includes(s.id)));
  }
  if (f.own_project) {
    const pid = resolveRef(ctx, "own_project", f.own_project);
    list = list.filter((i) => i.own_project_id === pid);
  }
  if (f.general) list = list.filter((i) => i.own_project_id == null);
  list = list.filter((i) => has(o.q, i.title, i.problem, i.notes));
  return page(list, o.limit, o.offset);
}

export const ideaGet = (ctx: Ctx, id: number): IdeaStats | undefined => ideaStats(ctx).find((i) => i.id === id);

/** The stored row of one idea */
export const ideaRef = (ctx: Ctx, id: number): IdeaRecord | undefined => keptRow<IdeaRecord>(ctx, "SELECT * FROM ideas WHERE id = ?", id);

/** Filters: idea_id, person_id, interest; q searches person, idea and note */
export function interestList(ctx: Ctx, o: ListOpts): { rows: InterestRow[]; total: number } {
  const f = o.filter ?? {};
  let list = ideaPeople(ctx, f.idea_id ? Number(f.idea_id) : undefined, f.person_id ? Number(f.person_id) : undefined);
  if (f.interest) list = list.filter((x) => x.interest === f.interest);
  list = list.filter((x) => has(o.q, x.person_name, x.idea_title, x.note));
  return page(list, o.limit, o.offset);
}

export const interestGet = (ctx: Ctx, id: number): InterestRow | undefined => ideaPeople(ctx).find((x) => x.id === id);
