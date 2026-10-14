import type { Ctx, OwnProjectsApi } from "@fullfollow/core";
import { ownProjectsServices } from "./service";
import { ownProjectGet, ownProjectList, ownProjectStats } from "./service/list";
import { ownProjectRef } from "./service/projects";

/** The own-projects module's implementation of its contract (`OwnProjectsApi` in core's contracts) */
export function ownProjectsApi(ctx: Ctx): OwnProjectsApi {
  const { ownProjects } = ownProjectsServices(ctx);
  return {
    // rows come from text and enum columns; the contract narrows what the schema keeps loose
    create: ownProjects.create as OwnProjectsApi["create"],
    update: ownProjects.update as OwnProjectsApi["update"],
    move: ownProjects.move as OwnProjectsApi["move"],
    remove: ownProjects.remove,
    fromIdea: ownProjects.fromIdea as OwnProjectsApi["fromIdea"],
    list: (opts) => ownProjectList(ctx, opts),
    get: (id) => ownProjectGet(ctx, id),
    ref: (id) => ownProjectRef(ctx, id),
    stats: () => ownProjectStats(ctx),
  };
}
