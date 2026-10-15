import type { PostFormat } from "@kit/lib/labels";

/** Names of the post formats (the kind of a post, `posts.format`) */
export const POST_FORMAT: Record<PostFormat, string> = { metin: "Metin", gorsel: "Görsel", video: "Video", karusel: "Karusel" };
export const POST_FORMATS = Object.keys(POST_FORMAT) as PostFormat[];
