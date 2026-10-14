/**
 * Contracts: the public API of every feature module, as TypeScript types only.
 *
 * Rules:
 * - Types only. No runtime code, no imports of module packages.
 * - A contract stays in core when its module is removed, so code that optionally
 *   uses that module (`ctx.mod("pipeline")?.…`) still typechecks, and an outside
 *   user can code against it without reading the module's inside.
 * - A module's `api.ts` implements its contract; other modules and the hosts only
 *   ever see the contract.
 *
 * To add a module contract (example for a "pipeline" module, in
 * `contracts/pipeline.ts`):
 *
 *   export interface PipelineApi { openCount(personId: number): number }
 *   export interface OpportunityWon { opportunityId: number; offer: { title: string; amount: number } }
 *
 * then register it here, so `ctx.mod("pipeline")` and `ctx.emit("opportunity.won", …)` are typed:
 *
 *   import type { OpportunityWon, PipelineApi } from "./pipeline";
 *   export interface ModuleApis { pipeline: PipelineApi }
 *   export interface ModuleEvents { "opportunity.won": OpportunityWon }
 */

import type { CalendarApi } from "./calendar";

export type * from "./calendar";

/** Module key to the API that module exposes through `ctx.mod(key)`. */
export interface ModuleApis {
  calendar: CalendarApi;
}

/** Event name to its payload type. Names not listed here are accepted with an `unknown` payload. */
export interface ModuleEvents {}
