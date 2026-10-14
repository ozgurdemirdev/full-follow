import { PaymentsController } from "./payments.controller";
import { ProjectsController } from "./projects.controller";

/** The projects module's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [ProjectsController, PaymentsController];
