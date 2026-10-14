import { monthOf, type Ctx, type MonthReport } from "@fullfollow/core";
import { priceFloor } from "./floor";
import { insightOf } from "./insight";

export function reportsService(ctx: Ctx) {
  /** Kaynak bazında dönüşüm: kazanılan / kapanan (kazanılan + kaybedilen). Açık fırsatlar paydaya girmez. Empty without the pipeline module. */
  const bySource = () => ctx.mod("pipeline")?.bySource() ?? [];

  /** Bir ayın tahsilatı (her ödeme girişi kendi tarihinin ayına, kısmi ödemeler dahil) ve fiyat tabanı ile farkı */
  function month(m?: string): MonthReport {
    const ym = m ? m.slice(0, 7) : monthOf(ctx.clock.today());
    // without the projects module nothing is collected or due
    const projects = ctx.mod("projects");
    const collected = projects?.collectedIn(ym) ?? 0;
    const expected = projects?.outstandingDue(ym) ?? 0;
    const f = priceFloor(ctx);
    const lost = ctx.mod("pipeline")?.lostIn(ym) ?? null;
    const insight = insightOf({ month: ym, current: monthOf(ctx.clock.today()), collected, due: expected, floor: f.floor, lost });
    return { month: ym, collected, outstanding_due: expected, floor: f.floor, floor_detail: f, gap: collected - f.floor, insight, lost };
  }

  /** Son N ay (eskiden yeniye), grafik için */
  function months(count: number, until?: string): MonthReport[] {
    const end = (until ?? ctx.clock.today()).slice(0, 7);
    let [y, mo] = end.split("-").map(Number);
    const list: string[] = [];
    for (let i = 0; i < count; i++) {
      list.unshift(`${y}-${String(mo).padStart(2, "0")}`);
      mo--; if (mo === 0) { mo = 12; y--; }
    }
    return list.map((m) => month(m));
  }

  return { bySource, sourceFunnel: (period?: unknown) => ctx.mod("pipeline")?.funnel(period), month, months, report: (m?: string) => ({ sources: bySource(), month: month(m) }) };
}
