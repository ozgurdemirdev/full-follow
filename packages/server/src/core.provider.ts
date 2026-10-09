import { createCore, openDb, type Core } from "@fullfollow/core";

export const CORE = Symbol("CORE");
export type { Core };

/** Web her işlemi actor = "ozgur" ile yapar */
export const coreProvider = {
  provide: CORE,
  useFactory: (): Core => createCore(openDb(), "ozgur"),
};
