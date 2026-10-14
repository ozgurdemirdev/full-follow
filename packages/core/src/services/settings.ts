import { z } from "zod";
import { CHANNEL_LIMIT_DEFAULTS, CHANNEL_LIMIT_MAX, CHANNELS, CHAT_PINNED_MAX, DEFAULT_PAYMENT_TEMPLATE, MARKETING_DEFAULTS, MILESTONES, NETWORK_DEFAULTS, POST_REFRESH_DEFAULT_DAYS, POST_REFRESH_MAX_DAYS, SETTING_KEYS, type Channel } from "../constants";
import { emit, FFError, parse, row, type Ctx } from "../context";
import { id as idSchema } from "../schemas/kit";
import { isIsoDate, resolveRelativeDate } from "../dates";
import { settings } from "../db/schema";

export const readSetting = (ctx: Ctx, key: string): string | undefined =>
  row<{ value: string }>(ctx, "SELECT value FROM settings WHERE key = ?", key)?.value;

const templateSchema = z.array(z.object({
  milestone: z.enum(MILESTONES),
  percent: z.coerce.number().positive().max(100),
  days: z.coerce.number().int().min(0).default(0),
})).min(1);

export type PaymentTemplate = z.infer<typeof templateSchema>;

export function readTemplate(ctx: Ctx): PaymentTemplate {
  const raw = readSetting(ctx, "payment_template");
  if (!raw) return DEFAULT_PAYMENT_TEMPLATE.map((t) => ({ ...t }));
  return templateSchema.parse(JSON.parse(raw));
}

/** Takip dizisi günleri: artan, 1-90 gün, en fazla 5 adım. "3,7" ya da [3,7] kabul edilir. */
const followupSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.split(/[,\s]+/).filter(Boolean).map(Number) : v),
  z.array(z.coerce.number().int().min(1).max(90)).max(5),
).refine((a) => a.every((n, i) => i === 0 || n > a[i - 1]), "takip günleri artan sırada olmalı (örn. 3,7)");

export type ChannelLimits = Partial<Record<Channel, number>>;

/** Daily limit per channel: {"email":20}. Only known channels; 0 or empty removes a limit. */
const channelLimitsSchema = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() ? JSON.parse(v) : {}) : (v ?? {})),
  z.partialRecord(z.enum(CHANNELS), z.preprocess((n) => (n === "" || n === null ? 0 : n), z.coerce.number().int().min(0).max(CHANNEL_LIMIT_MAX))),
).transform((o): ChannelLimits => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0)));

/** Date the email warmup ends (inclusive); empty = no warmup */
const warmupUntilSchema = z.preprocess(
  (v) => (v === null || v === undefined ? "" : resolveRelativeDate(v)),
  z.union([z.literal(""), z.string().refine(isIsoDate, "tarih YYYY-AA-GG olmalı")]),
);

/** Marketing settings: follow-up days, weekly outgoing target, daily channel limits and the email warmup end date */
export function marketingSettings(ctx: Ctx): { followup_days: number[]; weekly_target: number; channel_limits: ChannelLimits; email_warmup_until: string } {
  let followup_days: number[] = [...MARKETING_DEFAULTS.followup_days];
  const raw = readSetting(ctx, "followup_days");
  if (raw !== undefined) {
    try {
      followup_days = followupSchema.parse(JSON.parse(raw));
    } catch {
      /* bozuk değer: varsayılan */
    }
  }
  let channel_limits: ChannelLimits = { ...CHANNEL_LIMIT_DEFAULTS };
  const limits = readSetting(ctx, "channel_limits");
  if (limits !== undefined) {
    try {
      channel_limits = channelLimitsSchema.parse(limits);
    } catch {
      /* broken value: defaults */
    }
  }
  return {
    followup_days, channel_limits, email_warmup_until: readSetting(ctx, "email_warmup_until") ?? "",
    weekly_target: Number(readSetting(ctx, "weekly_target") ?? MARKETING_DEFAULTS.weekly_target) || 0,
  };
}

/** The own project Özgür works on first: the stored id while that project still exists, else null */
function focusOwnProject(ctx: Ctx): number | null {
  const id = Number(readSetting(ctx, "focus_own_project_id")) || null;
  return id && row(ctx, "SELECT 1 x FROM own_projects WHERE id = ?", id) ? id : null;
}

/** Days after which a post without an interval of its own is due for a refresh */
export const postRefreshDays = (ctx: Ctx): number => Number(readSetting(ctx, "post_refresh_days")) || POST_REFRESH_DEFAULT_DAYS;

const num = (ctx: Ctx, key: string) => Number(readSetting(ctx, key) ?? 0) || 0;

export function settingsService(ctx: Ctx) {
  /** Tüm ayarlar (girilmemiş sayılar 0, şablon varsayılan) */
  function all() {
    return {
      bagkur_monthly: num(ctx, "bagkur_monthly"),
      accounting_monthly: num(ctx, "accounting_monthly"),
      other_fixed_monthly: num(ctx, "other_fixed_monthly"),
      target_net_monthly: num(ctx, "target_net_monthly"),
      tax_rate_percent: num(ctx, "tax_rate_percent"),
      payment_template: readTemplate(ctx),
      chat_pinned_notes: readSetting(ctx, "chat_pinned_notes") ?? "",
      focus_own_project_id: focusOwnProject(ctx),
      post_refresh_days: postRefreshDays(ctx),
    };
  }

  /** Fiyat tabanı (aylık) = (Bağkur + muhasebe + diğer sabit + hedef net) / (1 − vergi oranı) */
  function priceFloor() {
    const s = all();
    const subtotal = s.bagkur_monthly + s.accounting_monthly + s.other_fixed_monthly + s.target_net_monthly;
    const floor = Math.ceil(subtotal / (1 - s.tax_rate_percent / 100));
    return { ...s, subtotal, floor };
  }

  function set(key: string, value: unknown): void {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      throw new FFError("validation", `bilinmeyen ayar "${key}" (geçerli: ${SETTING_KEYS.join(", ")})`);
    }
    let stored: string;
    if (key === "payment_template") {
      const t = parse(templateSchema, typeof value === "string" ? JSON.parse(value) : value);
      const sum = t.reduce((a, x) => a + x.percent, 0);
      if (Math.abs(sum - 100) > 0.001) throw new FFError("validation", `ödeme şablonu yüzdeleri toplamı 100 olmalı (şu an ${sum})`);
      stored = JSON.stringify(t);
    } else if (key === "followup_days") {
      stored = JSON.stringify(parse(followupSchema, value));
    } else if (key === "channel_limits") {
      stored = JSON.stringify(parse(channelLimitsSchema, value));
    } else if (key === "email_warmup_until") {
      stored = parse(warmupUntilSchema, value);
    } else if (key === "chat_pinned_notes") {
      stored = parse(z.string().trim().max(CHAT_PINNED_MAX), value);
    } else if (key === "focus_own_project_id") {
      // empty or null clears the focus; an id must be an own project that exists
      const id = value === null || value === "" ? null : parse(idSchema, value);
      if (id !== null && !row(ctx, "SELECT 1 x FROM own_projects WHERE id = ?", id)) throw new FFError("not_found", `kendi projesi #${id} bulunamadı`);
      stored = id === null ? "" : String(id);
    } else if (key === "post_refresh_days") {
      stored = String(parse(z.coerce.number().int().min(1).max(POST_REFRESH_MAX_DAYS), value));
    } else if (key === "tax_rate_percent") {
      const n = parse(z.coerce.number().min(0).lt(100), value);
      stored = String(n);
    } else {
      stored = String(parse(z.coerce.number().int().min(0), value));
    }
    const t = ctx.clock.now();
    ctx.db.transaction((tx) => {
      tx.insert(settings).values({ key, value: stored, updated_at: t, updated_by: ctx.actor })
        .onConflictDoUpdate({ target: settings.key, set: { value: stored, updated_at: t, updated_by: ctx.actor } }).run();
      emit(tx, ctx, { type: "settings.updated", summary: `Ayar: ${key}`, data: { key, value: stored } });
    });
  }

  function setMany(data: Record<string, unknown>) {
    const keys = Object.keys(data);
    if (!keys.length) throw new FFError("validation", "ayar verisi boş");
    for (const k of keys) set(k, data[k]);
    return { keys, effects: [] as string[] };
  }

  return { all, priceFloor, set, setMany };
}

/** Network settings: the days an answer is awaited and a connection takes to cool, plus the marketing settings */
export function networkSettings(ctx: Ctx) {
  const n = (k: keyof typeof NETWORK_DEFAULTS) => {
    const v = readSetting(ctx, k);
    return v === undefined ? NETWORK_DEFAULTS[k] : Number(v) || NETWORK_DEFAULTS[k];
  };
  return { reply_wait_days: n("reply_wait_days"), cooling_days: n("cooling_days"), ...marketingSettings(ctx) };
}
