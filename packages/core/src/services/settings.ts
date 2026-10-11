import { z } from "zod";
import { CHAT_PINNED_MAX, DEFAULT_PAYMENT_TEMPLATE, MARKETING_DEFAULTS, MILESTONES, SETTING_KEYS } from "../constants";
import { emit, FFError, parse, row, type Ctx } from "../context";
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

/** Pazarlama ayarları (Paket 2): takip dizisi günleri ve haftalık giden mesaj hedefi */
export function marketingSettings(ctx: Ctx): { followup_days: number[]; weekly_target: number } {
  let followup_days: number[] = [...MARKETING_DEFAULTS.followup_days];
  const raw = readSetting(ctx, "followup_days");
  if (raw !== undefined) {
    try {
      followup_days = followupSchema.parse(JSON.parse(raw));
    } catch {
      /* bozuk değer: varsayılan */
    }
  }
  return { followup_days, weekly_target: Number(readSetting(ctx, "weekly_target") ?? MARKETING_DEFAULTS.weekly_target) || 0 };
}

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
    } else if (key === "chat_pinned_notes") {
      stored = parse(z.string().trim().max(CHAT_PINNED_MAX), value);
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
