import type { Ctx, ReferralsApi } from "@fullfollow/core";
import { referralKpis, referralTree } from "./service/tree";
import { referralValues } from "./service/referrals";
import { referralSuggestions } from "./service/suggestions";

/** The referrals module's implementation of its contract (`ReferralsApi` in core's contracts) */
export function referralsApi(ctx: Ctx): ReferralsApi {
  return {
    report: () => referralValues(ctx),
    of: (personId) => referralValues(ctx).find((r) => r.person_id === personId) ?? null,
    kpis: () => referralKpis(ctx),
    tree: (personId) => referralTree(ctx, personId),
    suggestions: () => referralSuggestions(ctx),
  };
}
