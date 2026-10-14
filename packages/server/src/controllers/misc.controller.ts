import { Body, Controller, Get, Inject, Param, Put, Query } from "@nestjs/common";
import {
  CHANNELS, DIRECTIONS, DRAFT_STATUSES,
  SOURCE_KINDS, TAGS, TOUCH_KINDS, LABELS, CONNECTION_TAGS, NETWORK_DEFAULTS,
  TEMPLATE_KINDS, IDEA_STAGES, INTEREST_LEVELS, MARKETING_DEFAULTS, CONTACT_STATUSES, TAG_COLORS,
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

  /** Installed feature modules: [{ key, label }] */
  @Get("modules")
  modules() {
    return this.core.modules.list().map((m) => ({ key: m.key, label: m.label }));
  }

  /** Formlar ve etiketler için sabit listeler */
  @Get("meta")
  meta() {
    return {
      tags: TAGS, source_kinds: SOURCE_KINDS, channels: CHANNELS, directions: DIRECTIONS,
      touch_kinds: TOUCH_KINDS, connection_tags: CONNECTION_TAGS, network_defaults: NETWORK_DEFAULTS, draft_statuses: DRAFT_STATUSES, comment_targets: this.core.commentTargets(), labels: LABELS,
      template_kinds: TEMPLATE_KINDS, idea_stages: IDEA_STAGES, interest_levels: INTEREST_LEVELS, marketing_defaults: MARKETING_DEFAULTS,
      contact_statuses: CONTACT_STATUSES, tag_colors: TAG_COLORS,
      ...this.core.moduleMeta(),
    };
  }

  /** Bugün ekranı */
  @Get("today")
  today(@Query("limit") limit?: string) {
    return this.core.today(limit ? Number(limit) : 50);
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
