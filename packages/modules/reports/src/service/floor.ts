import { settingValues, type Ctx, type PriceFloor } from "@fullfollow/core";

/** Fiyat tabanı (aylık) = (Bağkur + muhasebe + diğer sabit + hedef net) / (1 − vergi oranı) */
export function floorOf(settings: ReturnType<typeof settingValues>): Pick<PriceFloor, "subtotal" | "floor"> {
  const subtotal = settings.bagkur_monthly + settings.accounting_monthly + settings.other_fixed_monthly + settings.target_net_monthly;
  return { subtotal, floor: Math.ceil(subtotal / (1 - settings.tax_rate_percent / 100)) };
}

/** The settings values with the floor computed from them (what `floor_detail` of a month report carries) */
export function priceFloor(ctx: Ctx): PriceFloor {
  const values = settingValues(ctx);
  return { ...values, ...floorOf(values) };
}
