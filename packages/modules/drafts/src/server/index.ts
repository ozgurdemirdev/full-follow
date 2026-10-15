import { DraftsController } from "./drafts.controller";
import { FollowupsController } from "./followups.controller";

/** The drafts module's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [DraftsController, FollowupsController];
export { docs } from "./openapi";
