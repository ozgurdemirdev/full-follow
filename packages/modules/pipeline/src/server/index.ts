import { FunnelController } from "./funnel.controller";
import { OffersController } from "./offers.controller";
import { OpportunitiesController } from "./opportunities.controller";
import { OpportunityPeopleController } from "./opportunity-people.controller";

/** The pipeline module's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [OpportunitiesController, OffersController, OpportunityPeopleController, FunnelController];
export { docs } from "./openapi";
