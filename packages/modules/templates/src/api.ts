import type { Ctx, TemplatesApi } from "@fullfollow/core";
import { templatesServices } from "./service";
import { templateGet, templateList } from "./service/list";
import { templateComparison, templateStats } from "./service/stats";
import { templateRef } from "./service/templates";

/** The templates module's implementation of its contract (`TemplatesApi` in core's contracts) */
export function templatesApi(ctx: Ctx): TemplatesApi {
  const { templates } = templatesServices(ctx);
  return {
    // rows come from text and enum columns; the contract narrows what the schema keeps loose
    create: templates.create as TemplatesApi["create"],
    update: templates.update as TemplatesApi["update"],
    remove: templates.remove,
    render: templates.render,
    suggest: templates.suggest,
    list: (opts) => templateList(ctx, opts),
    get: (id) => templateGet(ctx, id),
    ref: (id) => templateRef(ctx, id),
    stats: () => templateStats(ctx),
    comparison: () => templateComparison(ctx),
  };
}
