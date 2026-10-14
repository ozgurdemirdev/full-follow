import { Controller, Get, Inject } from "@nestjs/common";
import { APP_TOKEN, type Core } from "@fullfollow/core";

@Controller("api/report/referrals")
export class ReferralsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  /** Referans değeri (kimin tanıttıklarından ne kadar fırsat ve iş geldi), teşekkür edilecekler ve referans istenecekler */
  @Get()
  referrals() {
    const referrals = this.app.mod("referrals")!;
    return { leaders: referrals.report(), ...referrals.suggestions() };
  }
}
