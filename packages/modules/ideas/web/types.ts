import type { Interest, Post, Touch } from "@kit/api/types";

/** What `GET /ideas/:id?with=people,touches,posts` brings next to the idea */
export interface IdeaRelated {
  people?: Interest[];
  touches?: Touch[];
  posts?: Post[];
}
