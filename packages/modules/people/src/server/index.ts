import { PeopleController } from "./people.controller";

/** The people module's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [PeopleController];
export { docs } from "./openapi";
