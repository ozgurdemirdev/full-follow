import type { Ctx, ReferralsApi } from "@fullfollow/core";
import { referralValues } from "./service/referrals";
import { referralSuggestions } from "./service/suggestions";

/** The referrals module's implementation of its contract (`ReferralsApi` in core's contracts) */
export function referralsApi(ctx: Ctx): ReferralsApi {
  return {
    report: () => referralValues(ctx),
    of: (personId) => referralValues(ctx).find((r) => r.person_id === personId) ?? null,
    suggestions: () => referralSuggestions(ctx),
  };
}
