import type { CompanySegment } from "@fullfollow/core";
import { PARTNER_TAGS } from "./constants";

/** A project makes a client (Müşteri), a partner tag a partner (Partner), everything else is a lead (Aday); a client that is also tagged stays a client */
export function segmentOf(projects: number, tags: readonly { slug: string; deleted: boolean }[] = []): CompanySegment {
  if (projects > 0) return "client";
  return tags.some((t) => !t.deleted && PARTNER_TAGS.includes(t.slug)) ? "partner" : "lead";
}
