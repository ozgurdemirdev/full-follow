import { Controller, Get, Inject, Query } from "@nestjs/common";
import { APP_TOKEN, listLimit, type Core } from "@fullfollow/core";
import { NETWORK_HTTP_LIMIT } from "../service/constants";

/** The network views: who waits for an answer, who went cold, and the weekly and chart numbers */
@Controller("api")
export class NetworkController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  private get net() {
    return this.app.mod("network")!;
  }

  /** Network: cevap bekleyenler ve soğuyan bağlantılar */
  @Get("network")
  network(@Query("limit") limit?: string) {
    return this.net.lists(listLimit(limit) ?? NETWORK_HTTP_LIMIT);
  }

  /** Haftalık temas sayıları (bu hafta / geçen hafta, kanal kırılımı) */
  @Get("stats/week")
  week() {
    return this.net.weekStats();
  }

  /** Dashboard: günlük / haftalık / aylık temas grafiği, yeni kayıtlar, temas durumu dağılımı */
  @Get("stats/activity")
  activity(@Query("period") period?: string) {
    return this.net.activity(period);
  }
}
