import { PostsController } from "./posts.controller";

/** The posts module's NestJS controllers; the server mounts them through its generated module list */
export const controllers = [PostsController];
export { docs } from "./openapi";
