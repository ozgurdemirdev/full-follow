import { CompaniesController } from "./companies.controller";

/** The companies module's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [CompaniesController];
export { docs } from "./openapi";
