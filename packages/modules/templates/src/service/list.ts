import { has, page, sectorMatch, type Ctx, type ListOpts, type TemplateStats } from "@fullfollow/core";
import { templateStats } from "./stats";

/** Filters: kind, channel (a template for all channels fits any), sector (the sector and its sub sectors); q searches name, text and sector */
export function templateList(ctx: Ctx, o: ListOpts): { rows: TemplateStats[]; total: number } {
  const f = o.filter ?? {};
  let list = templateStats(ctx);
  if (f.kind) list = list.filter((t) => t.kind === f.kind);
  if (f.channel) list = list.filter((t) => !t.channel || t.channel === f.channel);
  if (f.sector) {
    const ids = sectorMatch(ctx, f.sector);
    list = list.filter((t) => !t.sector_id || ids.includes(t.sector_id));
  }
  list = list.filter((t) => has(o.q, t.name, t.body, t.sector_path));
  return page(list, o.limit, o.offset);
}

export const templateGet = (ctx: Ctx, id: number): TemplateStats | undefined => templateStats(ctx).find((t) => t.id === id);
