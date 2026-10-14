import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { APP_TOKEN, intId, type Core, type FeedQuery } from "@fullfollow/core";
import { RECORD_TIMELINE_HTTP_LIMIT } from "../constants";

@Controller("api/timeline")
export class TimelineController {
  constructor(@Inject(APP_TOKEN) private app: Core) {}

  /** Genel akış (yeniden eskiye): before = bir önceki sayfanın next_before'u, limit, type (temas,odeme,...), actor, since, q (özet ya da kayıt adı), record (person:12) */
  @Get()
  feed(@Query() q: FeedQuery) {
    return this.app.mod("timeline")!.feed(q);
  }

  /** Hafta şeridi: start = haftadan bir tarih (boşsa bu hafta) */
  @Get("week")
  week(@Query("start") start?: string) {
    return this.app.mod("timeline")!.week(start || undefined);
  }

  /** Kişi / fırsat / proje zaman çizelgesi (eskiden yeniye) */
  @Get(":type/:id")
  record(@Param("type") type: string, @Param("id") id: string, @Query("limit") limit?: string) {
    return this.app.mod("timeline")!.forRecord(type, intId(id), limit ? Number(limit) : RECORD_TIMELINE_HTTP_LIMIT);
  }
}
