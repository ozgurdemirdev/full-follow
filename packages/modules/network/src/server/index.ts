import { NetworkController } from "./network.controller";
import { TouchesController } from "./touches.controller";

/** The network's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [TouchesController, NetworkController];
export { docs } from "./openapi";
