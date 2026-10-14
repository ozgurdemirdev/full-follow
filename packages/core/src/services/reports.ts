import { monthOf } from "../dates";
import type { Ctx } from "../context";
import { settingsService } from "./settings";

export function reportsService(ctx: Ctx) {
  /** Kaynak bazında dönüşüm: kazanılan / kapanan (kazanılan + kaybedilen). Açık fırsatlar paydaya girmez. Empty without the pipeline module. */
  function bySource() {
    return ctx.mod("pipeline")?.bySource() ?? [];
  }

  /** Bir ayın tahsilatı (her ödeme girişi kendi tarihinin ayına, kısmi ödemeler dahil) ve fiyat tabanı ile farkı */
  function month(m?: string) {
    const ym = m ? m.slice(0, 7) : monthOf(ctx.clock.today());
    // without the projects module nothing is collected or due
    const projects = ctx.mod("projects");
    const collected = projects?.collectedIn(ym) ?? 0;
    const expected = projects?.outstandingDue(ym) ?? 0;
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

  return { bySource, sourceFunnel: (period?: unknown) => ctx.mod("pipeline")?.funnel(period), month, months, report };
}
