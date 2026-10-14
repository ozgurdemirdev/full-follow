import { Controller, Get, Inject, Query } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";

@Controller("api")
export class MarketingController {
  constructor(@Inject(CORE) private core: Core) {}

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
