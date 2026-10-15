import { docKit } from "@fullfollow/core";

/** API documentation of the referrals route (`GET /api/docs`) */
export const docs = docKit.defineDocs({
  "GET /api/report/referrals": {
    summary: "Get the referral report",
    description: "Referral value (how many opportunities and how much work each person's introductions brought), the numbers on top of the screen (`kpis`), people to thank and people to ask for referrals.",
    response: docKit.object,
  },
  "GET /api/report/referrals/tree/:id": {
    summary: "Get the referral tree below a person",
    description: "Whoever has the person as introducer, each person once, with what each brought (won and open value) and what everyone below brought; the bigger branches first.",
    response: docKit.object,
  },
});
