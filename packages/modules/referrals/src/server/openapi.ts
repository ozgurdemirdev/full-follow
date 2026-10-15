import { docKit } from "@fullfollow/core";

/** API documentation of the referrals route (`GET /api/docs`) */
export const docs = docKit.defineDocs({
  "GET /api/report/referrals": {
    summary: "Get the referral report",
    description: "Referral value (how many opportunities and how much work each person's introductions brought), people to thank and people to ask for referrals.",
    response: docKit.object,
  },
});
