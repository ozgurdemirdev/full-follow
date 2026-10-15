import { Controller, Get, Inject, Query } from "@nestjs/common";
import { APP_TOKEN, intQuery, type Core } from "@fullfollow/core";
import { REPORT_MONTHS_DEFAULT, REPORT_MONTHS_MAX } from "../constants";

@Controller("api")
export class ReportsController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  /** Rapor: kaynak dönüşümü + ay tahsilatı vs fiyat tabanı */
  @Get("report")
  report(@Query("month") month?: string) {
    return this.app.mod("reports")!.report(month);
  }

  /** Son N ayın tahsilat/taban serisi (grafik) */
  @Get("report/months")
  months(@Query("count") count?: string) {
    return this.app.mod("reports")!.months(intQuery("count", count, 1, REPORT_MONTHS_MAX) ?? REPORT_MONTHS_DEFAULT);
  }

  /** Pazarlama özeti: paylaşımlar, fikirler, şablonlar, kanal performansı */
  @Get("report/marketing")
  marketing() {
    return this.app.mod("reports")!.marketing();
  }

  /** Haftalık inceleme (Cuma özeti): week = YYYY-Www ya da o haftadan bir tarih, boşsa bu hafta */
  @Get("review")
  review(@Query("week") week?: string) {
    return this.app.mod("reports")!.review(week);
  }
}
