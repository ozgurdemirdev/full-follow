import type { EntityHandler } from "@fullfollow/core";
import { networkServices } from "./service";
import { TOUCH_ALIASES } from "./service/constants";

/** The "touch" record type, for the generic save / find / get / delete (the web and MCP use this name) */
export const entities: Record<string, EntityHandler> = {
  touch: {
    aliases: TOUCH_ALIASES,
    save: (ctx, d, id) => (id ? networkServices(ctx).touches.update(id, d) : networkServices(ctx).touches.create(d)),
    get: (ctx, id) => networkServices(ctx).touches.get(id),
    find: (ctx, o) => networkServices(ctx).touches.list(o),
    delete: (ctx, id) => networkServices(ctx).touches.remove(id),
  },
};
