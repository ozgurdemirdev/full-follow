import { Body, Controller, Get, Inject, Param, Put, Query } from "@nestjs/common";
import {
  CHANNELS, COMMENT_TARGETS, DIRECTIONS, DRAFT_STATUSES, MILESTONES, OPP_STAGES, OPEN_OPP_STAGES,
  PROJECT_STAGES, SOURCE_KINDS, TAGS, TOUCH_KINDS, LABELS, CONNECTION_TAGS, NETWORK_DEFAULTS,
  POST_PLATFORMS, TEMPLATE_KINDS, IDEA_STAGES, INTEREST_LEVELS, MARKETING_DEFAULTS, CONTACT_STATUSES, TAG_COLORS,
} from "@fullfollow/core";
import { CORE, type Core } from "../core.provider";
import { intId } from "../http";

@Controller("api")
export class MiscController {
  constructor(@Inject(CORE) private core: Core) {}

  /** Giriş gerektirmez: sunucu ayakta mı */
  @Get("health")
  health() {
    return { ok: true };
  }

  /** Formlar ve etiketler için sabit listeler */
  @Get("meta")
  meta() {
    return {
      tags: TAGS, source_kinds: SOURCE_KINDS, opp_stages: OPP_STAGES, open_opp_stages: OPEN_OPP_STAGES,
      project_stages: PROJECT_STAGES, milestones: MILESTONES, channels: CHANNELS, directions: DIRECTIONS,
      touch_kinds: TOUCH_KINDS, connection_tags: CONNECTION_TAGS, network_defaults: NETWORK_DEFAULTS, draft_statuses: DRAFT_STATUSES, comment_targets: COMMENT_TARGETS, labels: LABELS,
      post_platforms: POST_PLATFORMS, template_kinds: TEMPLATE_KINDS, idea_stages: IDEA_STAGES, interest_levels: INTEREST_LEVELS, marketing_defaults: MARKETING_DEFAULTS,
      contact_statuses: CONTACT_STATUSES, tag_colors: TAG_COLORS,
    };
  }

  /** Bugün ekranı */
  @Get("today")
  today(@Query("limit") limit?: string) {
    return this.core.today(limit ? Number(limit) : 50);
  }

  /** Network: cevap bekleyenler ve soğuyan bağlantılar */
  @Get("network")
  network(@Query("limit") limit?: string) {
    return this.core.network(limit ? Number(limit) : 50);
  }

  /** Haftalık temas sayıları (bu hafta / geçen hafta, kanal kırılımı) */
  @Get("stats/week")
  week() {
    return this.core.reports.week();
  }

  /** Dashboard: günlük / haftalık / aylık temas grafiği, yeni kayıtlar, temas durumu dağılımı */
  @Get("stats/activity")
  activity(@Query("period") period?: string) {
    return this.core.reports.activity(period);
  }

  /** Referans değeri: kimin tanıttıklarından ne kadar fırsat ve iş geldi */
  @Get("report/referrals")
  referrals() {
    return this.core.reports.referrals();
  }

  /** Rapor: kaynak dönüşümü + ay tahsilatı vs fiyat tabanı */
  @Get("report")
  report(@Query("month") month?: string) {
    return this.core.reports.report(month);
  }

  /** Son N ayın tahsilat/taban serisi (grafik) */
  @Get("report/months")
  months(@Query("count") count?: string) {
    return this.core.reports.months(count ? Number(count) : 6);
  }

  /** Kişi / fırsat / proje zaman çizelgesi (eskiden yeniye) */
  @Get("timeline/:type/:id")
  timeline(@Param("type") type: string, @Param("id") id: string, @Query("limit") limit?: string) {
    return this.core.timeline(type, intId(id), limit ? Number(limit) : 50);
  }

  @Get("settings")
  settings() {
    return this.core.settings.priceFloor();
  }

  @Put("settings")
  saveSettings(@Body() b: Record<string, unknown>) {
    this.core.settings.setMany(b);
    return this.core.settings.priceFloor();
  }
}
