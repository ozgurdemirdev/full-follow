import { createCore, createRegistry, systemClock, type Actor, type Clock, type DbHandle } from "@fullfollow/core";
import { modules } from "./modules.generated";

export { modules as installedModules, modulesOff } from "./modules.generated";

/**
 * The app: core plus every installed feature module (the generated list).
 * With no modules installed it is exactly today's core. Web (actor="owner") and MCP (actor="claude") both start here.
 */
export function createApp(handle: DbHandle, actor: Actor, clock: Clock = systemClock) {
  return createCore(handle, actor, clock, createRegistry(modules));
}

export type App = ReturnType<typeof createApp>;
