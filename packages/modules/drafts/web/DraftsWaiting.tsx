import { Link } from "wouter";
import { m } from "./messages";
import { DRAFTS_PATH } from "./paths";

/** "N taslak onay bekliyor" under a person's or a company's deals (slots "person.overlay.deals" and "company.overlay.work.after"): `card` is the card of that record */
export function DraftsWaiting({ card }: { card?: { drafts: unknown[] } }) {
  const n = card?.drafts.length ?? 0;
  return n ? <Link href={DRAFTS_PATH} className="text-base-sm">{m.waiting(n)}</Link> : null;
}
