import { monthOf } from "../dates";
import { rows, type Ctx } from "../context";
import { referralValues, weekStats } from "./network";
import { collectedIn } from "./payments";
import { settingsService } from "./settings";
import { activity } from "./activity";
import { sourceFunnel } from "./sourceFunnel";

export function reportsService(ctx: Ctx) {
  /** Kaynak bazında dönüşüm: kazanılan / kapanan (kazanılan + kaybedilen). Açık fırsatlar paydaya girmez. */
  function bySource() {
    return rows(ctx, `
      SELECT s.id AS source_id, s.name AS source,
        COUNT(o.id) AS total,
        COALESCE(SUM(o.stage = 'kazanildi'), 0) AS won,
        COALESCE(SUM(o.stage = 'kaybedildi'), 0) AS lost,
        COALESCE(SUM(o.stage NOT IN ('kazanildi','kaybedildi')), 0) AS open,
        COALESCE(SUM(CASE WHEN o.stage = 'kazanildi' THEN COALESCE(o.estimated_value, 0) END), 0) AS won_value
      FROM sources s LEFT JOIN opportunities o ON o.source_id = s.id
      GROUP BY s.id ORDER BY won DESC, total DESC, s.name`)
      .map((r) => ({ ...r, conversion: r.won + r.lost > 0 ? r.won / (r.won + r.lost) : null }));
  }

  /** Bir ayın tahsilatı (her ödeme girişi kendi tarihinin ayına, kısmi ödemeler dahil) ve fiyat tabanı ile farkı */
  function month(m?: string) {
    const ym = m ? m.slice(0, 7) : monthOf(ctx.clock.today());
    const collected = collectedIn(ctx, ym);
    const expected = rows(ctx, "SELECT COALESCE(SUM(expected_amount - paid_amount),0) v FROM payments WHERE due_date IS NOT NULL AND substr(due_date,1,7) = ? AND paid_amount < expected_amount", ym)[0].v as number;
    const f = settingsService(ctx).priceFloor();
    return { month: ym, collected, outstanding_due: expected, floor: f.floor, floor_detail: f, gap: collected - f.floor };
  }

  /** Son N ay (eskiden yeniye) — grafik için */
  function months(count = 6, until?: string) {
    const end = (until ?? ctx.clock.today()).slice(0, 7);
    let [y, mo] = end.split("-").map(Number);
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.unshift(`${y}-${String(mo).padStart(2, "0")}`);
      mo--; if (mo === 0) { mo = 12; y--; }
    }
    return list.map((m) => month(m));
  }

  function report(m?: string) {
    return { sources: bySource(), month: month(m) };
  }

  return { bySource, sourceFunnel: (period?: unknown) => sourceFunnel(ctx, period), month, months, report, referrals: () => referralValues(ctx), week: () => weekStats(ctx), activity: (period?: string) => activity(ctx, period) };
}
