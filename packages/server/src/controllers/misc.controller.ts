import { Body, Controller, Get, Inject, Put, Query } from "@nestjs/common";
import {
  CHANNELS, DIRECTIONS,
  SOURCE_KINDS, TAGS, TOUCH_KINDS, LABELS, CONNECTION_TAGS, NETWORK_DEFAULTS,
  CONTACT_STATUSES, TAG_COLORS,
} from "@fullfollow/core";
import { TODAY_ROWS_DEFAULT } from "../constants";
import { CORE, type Core } from "../core.provider";

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
      touch_kinds: TOUCH_KINDS, connection_tags: CONNECTION_TAGS, network_defaults: NETWORK_DEFAULTS, comment_targets: this.core.commentTargets(), labels: LABELS,
      contact_statuses: CONTACT_STATUSES, tag_colors: TAG_COLORS,
      ...this.core.moduleMeta(),
    };
  }

  /** Bugün ekranı */
  @Get("today")
  today(@Query("limit") limit?: string) {
    return this.core.today(limit ? Number(limit) : TODAY_ROWS_DEFAULT);
  }

  @Get("settings")
  settings() {
    return this.core.settings.view();
  }

  @Put("settings")
  saveSettings(@Body() b: Record<string, unknown>) {
    this.core.settings.setMany(b);
    return this.core.settings.view();
  }
}
