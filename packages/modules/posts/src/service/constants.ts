import type { PostFormat } from "@fullfollow/core";

/** How a post is made */
export const POST_FORMATS = ["metin", "gorsel", "video", "karusel"] as const satisfies readonly PostFormat[];
/** Paylaşım platformları (forum konusu, gönderi) */
export const POST_PLATFORMS = ["r10", "linkedin", "instagram", "diger"] as const;
export const PLATFORM_LABEL: Record<string, string> = { r10: "R10", linkedin: "LinkedIn", instagram: "Instagram", diger: "Diğer" };
