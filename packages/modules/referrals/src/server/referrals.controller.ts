import { Controller, Get, Inject, Param } from "@nestjs/common";
import { APP_TOKEN, intId, type Core } from "@fullfollow/core";

@Controller("api/report/referrals")
export class ReferralsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  /** Referans değeri (kimin tanıttıklarından ne kadar fırsat ve iş geldi), teşekkür edilecekler ve referans istenecekler */
  @Get()
  referrals() {
    const referrals = this.app.mod("referrals")!;
    return { leaders: referrals.report(), kpis: referrals.kpis(), ...referrals.suggestions() };
  }

  /** The referral tree below one person (the picture of the screen); null when nobody is known by that id */
  @Get("tree/:id")
  tree(@Param("id") id: string) {
    return this.app.mod("referrals")!.tree(intId(id));
  }
}
