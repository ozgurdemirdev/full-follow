import type { Ctx } from "@fullfollow/core";
import { touchesService } from "./touches";

const cache = new WeakMap<Ctx, { touches: ReturnType<typeof touchesService> }>();

/** The network's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function networkServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { touches: touchesService(ctx) }));
  return s;
}
