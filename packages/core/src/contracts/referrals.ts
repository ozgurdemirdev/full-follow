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

/** One row of "Teşekkür zamanı" or "Kimden referans istenir" */
export interface ReferralSuggestion {
  person: { id: number; name: string };
  /** the sentence under the name */
  why: string;
  /** false: shown dimmed without a button (a payment is late) */
  ready: boolean;
  /** "asked": a request for Claude is open; "drafted": a draft waits in Taslaklar; "idle": neither (or the calendar and drafts modules are missing) */
  state: "idle" | "asked" | "drafted";
  /** the title of the task that asks Claude for the draft: the row is "asked" while that task is open */
  request_title: string;
}

/** The two lists beside the referral report */
export interface ReferralSuggestions {
  /** whoever introduced a person whose opportunity was won in the last days, newest first */
  thanks: ReferralSuggestion[];
  /** people whose project was delivered and paid up and who introduced nobody; the ones with a late payment come last, not ready */
  asks: ReferralSuggestion[];
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
  /** whom to thank and whom to ask for a referral; each list is empty without the module it reads (people, pipeline, projects) */
  suggestions(): ReferralSuggestions;
}
