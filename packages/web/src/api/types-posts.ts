import type { Post } from "./types";

/**
 * A post as the Posts screen reads it. `format` (metin, görsel, video, karusel, ...) is gap G17: core does not
 * store it yet, so the field is optional and the screen shows the format chip only when it is present.
 */
export interface PostRow extends Post {
  format?: string | null;
}
