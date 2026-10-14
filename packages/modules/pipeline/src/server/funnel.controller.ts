import { Controller, Get, Inject, Query } from "@nestjs/common";
import { APP_TOKEN, type Core } from "@fullfollow/core";

@Controller("api/report/sources")
export class FunnelController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  /** Kaynak hunisi: bulundu → yazıldı → cevap → görüşme → teklif → kazanıldı; period = 30 | 90 | all (kayıt tarihine göre) */
  @Get()
  funnel(@Query("period") period?: string) {
    return this.app.mod("pipeline")!.funnel(period);
  }
}
