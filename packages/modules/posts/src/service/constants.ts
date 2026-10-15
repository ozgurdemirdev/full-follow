import type { PostFormat } from "@fullfollow/core";

/** How a post is made */
export const POST_FORMATS = ["metin", "gorsel", "video", "karusel"] as const satisfies readonly PostFormat[];
/** Words that name the post record type in the generic tools */
export const POST_ALIASES = ["paylasim", "paylaşım", "posts"];
/** Paylaşım platformları (forum konusu, gönderi) */
export const POST_PLATFORMS = ["r10", "linkedin", "instagram", "diger"] as const;
/** Days between two refreshes of a post: the shortest and the longest a post may ask for */
export const REFRESH_DAYS_MIN = 1;
export const REFRESH_DAYS_MAX = 365;
/** Longest title or name written into an event summary */
export const EVENT_TITLE_LENGTH = 60;
/** MCP output: title lengths of a post line, its idea and the yield line of the marketing report, and how many posts the yield line names */
export const MCP_TITLE_LENGTH = 50;
export const MCP_IDEA_LENGTH = 30;
export const MCP_YIELD_TITLE_LENGTH = 30;
export const MCP_YIELD_POSTS = 5;
