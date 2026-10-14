import { GoalsController } from "./goals.controller";
import { TasksController } from "./tasks.controller";

/** The calendar's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [TasksController, GoalsController];
