import { defineModule } from "@fullfollow/core";
import { referralsApi } from "./api";
import { mcp } from "./mcp";
import { m } from "./messages";

/**
 * Referrals: the referral report, what the people a person introduced (and the people they introduced) brought in opportunities, wins and money.
 * It owns no table: the tree is `people.referred_by_id`, read through the people module; the numbers come from the pipeline and projects modules.
 */
export default defineModule({
  key: "referrals",
  label: m.label,
  smoke: ["/api/report/referrals"],
  uses: ["people", "pipeline", "projects", "calendar", "drafts"],
  api: referralsApi,
  mcp,
});
