import type { Ctx } from "@fullfollow/core";
import { paymentsService } from "./payments";
import { projectsService } from "./projects";

type Services = { projects: ReturnType<typeof projectsService>; payments: ReturnType<typeof paymentsService> };
const cache = new WeakMap<Ctx, Services>();

/** The projects module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function projectsServices(ctx: Ctx): Services {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { projects: projectsService(ctx), payments: paymentsService(ctx) }));
  return s;
}
