import { keptRows, type Ctx, type ReferralNode } from "@fullfollow/core";

/** Every person with the introducer id and the company name: the referral tree the referrals module walks */
export function referralTree(ctx: Ctx): ReferralNode[] {
  return keptRows<ReferralNode>(ctx, "SELECT p.id, p.name, p.referred_by_id, c.name AS company_name FROM people p LEFT JOIN companies c ON c.id = p.company_id");
}
