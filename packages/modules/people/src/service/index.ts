import type { Ctx } from "@fullfollow/core";
import { peopleService } from "./people";

const cache = new WeakMap<Ctx, { people: ReturnType<typeof peopleService> }>();

/** The people module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function peopleServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { people: peopleService(ctx) }));
  return s;
}
