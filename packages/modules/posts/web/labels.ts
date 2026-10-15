import { PLATFORM, type PostFormat } from "@kit/lib/labels";

export const PLATFORMS = Object.keys(PLATFORM);
export const PLATFORM_DOT: Record<string, string> = { r10: "bg-danger", linkedin: "bg-chip-opportunity-fg", instagram: "bg-entity-source", diger: "bg-entity-neutral" };

/** Names of the post formats (the kind of a post, `posts.format`) */
export const POST_FORMAT: Record<PostFormat, string> = { metin: "Metin", gorsel: "Görsel", video: "Video", karusel: "Karusel" };
export const POST_FORMATS = Object.keys(POST_FORMAT) as PostFormat[];
