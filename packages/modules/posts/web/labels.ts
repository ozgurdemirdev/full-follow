import { PLATFORM, type PostFormat } from "@kit/lib/labels";
import { m } from "./messages";

export const PLATFORMS = Object.keys(PLATFORM);
export const PLATFORM_DOT: Record<string, string> = { r10: "bg-danger", linkedin: "bg-chip-opportunity-fg", instagram: "bg-entity-source", diger: "bg-entity-neutral" };

/** Names of the post formats (the kind of a post, `posts.format`) */
export const POST_FORMAT: Record<PostFormat, string> = { metin: m.formats.metin, gorsel: m.formats.gorsel, video: m.formats.video, karusel: m.formats.karusel };
export const POST_FORMATS = Object.keys(POST_FORMAT) as PostFormat[];
