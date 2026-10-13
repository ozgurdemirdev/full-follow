import { Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { CORE, FOLLOWUPS, type AutoFollowups, type Core } from "../core.provider";

@Controller("api")
export class MarketingController {
  constructor(@Inject(CORE) private core: Core, @Inject(FOLLOWUPS) private auto: AutoFollowups) {}

  /** Zamanı gelen takipler (taslak bekleyen) */
  @Get("followups")
  due() {
    return this.core.followups.due();
  }

  /** Takip taslaklarını şimdi hazırla (zamanlayıcının yaptığını hemen yapar) */
  @Post("followups/run")
  run() {
    return this.auto.run();
  }

  /** Pazarlama özeti: paylaşımlar, fikirler, şablonlar, kanal performansı */
  @Get("report/marketing")
  marketing() {
    return this.core.marketing();
  }

  /** Haftalık inceleme (Cuma özeti): week = YYYY-Www ya da o haftadan bir tarih, boşsa bu hafta */
  @Get("review")
  review(@Query("week") week?: string) {
    return this.core.review(week);
  }
}
