import type { Idea, Interest, Post, Touch } from "./types";

/**
 * A general idea as the Ideas screen reads it. `money_note` is the money calculation text ("₺2.500 × 10 müşteri = ...")
 * of gap G16: not in core yet, so it is optional and the block hides while it is absent.
 */
export type IdeaRow = Idea & { money_note?: string | null };

/** What `GET /ideas/:id?with=people,touches,posts` brings next to the idea */
export interface IdeaRelated {
  people?: Interest[];
  touches?: Touch[];
  posts?: Post[];
}
