import type { Ctx } from "@fullfollow/core";
import { offersService } from "./offers";
import { opportunitiesService } from "./opportunities";
import { teamService } from "./team";

type Services = { opportunities: ReturnType<typeof opportunitiesService>; offers: ReturnType<typeof offersService>; team: ReturnType<typeof teamService> };
const cache = new WeakMap<Ctx, Services>();

/** The pipeline module's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function pipelineServices(ctx: Ctx): Services {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { opportunities: opportunitiesService(ctx), offers: offersService(ctx), team: teamService(ctx) }));
  return s;
}
