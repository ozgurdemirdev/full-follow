import type { Ctx } from "@fullfollow/core";
import { companiesService } from "./companies";

const cache = new WeakMap<Ctx, { companies: ReturnType<typeof companiesService> }>();

/** The companies module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function companiesServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { companies: companiesService(ctx) }));
  return s;
}
