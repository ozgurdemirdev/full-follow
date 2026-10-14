import type { Ctx } from "@fullfollow/core";
import { ownProjectsService } from "./projects";

const cache = new WeakMap<Ctx, { ownProjects: ReturnType<typeof ownProjectsService> }>();

/** The own-projects module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function ownProjectsServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { ownProjects: ownProjectsService(ctx) }));
  return s;
}
