import { Controller, Get, Inject } from "@nestjs/common";
import { APP_TOKEN, type Core } from "@fullfollow/core";

@Controller("api/report/referrals")
export class ReferralsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  /** Referans değeri: kimin tanıttıklarından ne kadar fırsat ve iş geldi */
  @Get()
  referrals() {
    return this.app.mod("referrals")!.report();
  }
}
