import type { ListOpts } from "../context";

/** Platform a post was shared on */
export type PostPlatform = "r10" | "linkedin" | "instagram" | "diger";

/** A post row as stored */
export interface PostRecord {
  id: number;
  platform: PostPlatform;
  title: string;
  url: string | null;
  body: string | null;
  /** ISO date */
  posted_at: string;
  /** days between refreshes; null = no reminder */
  refresh_days: number | null;
  refreshed_at: string | null;
  idea_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** A post with what it brought: the people who came from it, their opportunities, the won ones and their value */
export interface PostStats extends PostRecord {
  idea_title: string | null;
  people_count: number;
  opp_count: number;
  won: number;
  won_value: number;
  /** next refresh day, null when no interval is set */
  next_refresh_at: string | null;
  /** an interval is set and the next refresh day is today or earlier */
  refresh_due: boolean;
}

/**
 * Public API of the posts module (`ctx.mod("posts")`): shared posts (R10, LinkedIn, Instagram),
 * their refresh reminders and what each one brought. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface PostsApi {
  create(input: unknown): { row: PostRecord; effects: string[] };
  /** `refreshed: true` means "I updated it" (the refresh day becomes today) */
  update(id: number, input: unknown): { row: PostRecord; effects: string[] };
  /** people stay, only their source link is cleared */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  refresh(id: number): { row: PostRecord; effects: string[] };
  /** filters: platform, refresh_due, idea_id; newest first */
  list(opts: ListOpts): { rows: PostStats[]; total: number };
  /** every post with what it brought, newest first (the marketing report ranks them) */
  stats(): PostStats[];
  get(id: number): PostStats | undefined;
}
