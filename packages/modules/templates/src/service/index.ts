import type { Ctx } from "@fullfollow/core";
import { templatesService } from "./templates";

const cache = new WeakMap<Ctx, { templates: ReturnType<typeof templatesService> }>();

/** The templates module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function templatesServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { templates: templatesService(ctx) }));
  return s;
}
