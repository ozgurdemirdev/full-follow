/** What the people a person introduced brought: opportunities, wins, projects and money, over the whole referral tree below */
export interface ReferralValue {
  person_id: number;
  name: string;
  company_name: string | null;
  direct: number;
  network: number;
  opps: number;
  won: number;
  won_value: number;
  open_value: number;
  projects: number;
  collected: number;
}

/**
 * Public API of the referrals module (`ctx.mod("referrals")`): the referral report. The tree comes from the people module
 * (`PeopleApi.referralTree`), the opportunity and money numbers from the pipeline and projects modules (zero without them).
 */
export interface ReferralsApi {
  /** per introducer, best first: what the people below brought (GET /api/report/referrals) */
  report(): ReferralValue[];
  /** one person's value; null when nobody was introduced by the person */
  of(personId: number): ReferralValue | null;
}
