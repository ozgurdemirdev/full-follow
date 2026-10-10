import { useState } from "react";
import { useQuery } from "../api/store";
import type { MonthReport, Report as ReportData } from "../api/types";
import { Page } from "../app/Page";
import { Chip, ErrorBox, order, PageSkeleton } from "../components/ui";
import { fmtMonth, fmtMonthShort, pct, tl } from "../lib/format";

export default function Report() {
  const months = useQuery<MonthReport[]>("/report/months?count=6");
  const report = useQuery<ReportData>("/report");
  const [sel, setSel] = useState<number | null>(null);

  const list = months.data ?? [];
  const i = sel ?? list.length - 1;
  const m = list[i];
  const floor = m?.floor ?? 0;
  const max = Math.max(floor * 1.25, ...list.map((x) => x.collected), 1);
  const best = report.data?.sources.filter((s) => s.conversion != null).sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0];
  const f = m?.floor_detail;

  return (
    <Page title="Rapor" sub="Son 6 ay · tahsilat ve kaynak dönüşümü">
      {months.error && !months.data ? <ErrorBox error={months.error} retry={months.reload} /> : null}
      {!m ? (
        !months.error && <PageSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] desk:gap-9">
            <section className="card rise flex flex-col gap-7 p-9" style={order(1)} aria-label="Aylık tahsilat ve fiyat tabanı">
              <div className="flex flex-wrap items-baseline gap-5">
                <h2 className="m-0 flex-grow text-md font-semibold">Aylık tahsilat ve fiyat tabanı</h2>
                <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
                  <span className="w-6 border-t-2 border-dashed border-accent-warning" />Taban {tl(floor)}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="relative grid h-chart-height-mobile grid-cols-6 gap-3 border-b border-border-default desk:h-chart-height desk:gap-6">
                  {floor ? <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-accent-warning" style={{ bottom: `${(floor / max) * 100}%` }} /> : null}
                  {list.map((x, k) => {
                    const above = x.collected >= x.floor;
                    return (
                      <button key={x.month} type="button" aria-pressed={k === i} aria-label={`${fmtMonth(x.month)} ${tl(x.collected)}`} onClick={() => setSel(k)}
                        className="group flex h-full flex-col items-stretch justify-end border-0 bg-transparent p-0">
                        <div
                          className={`grow-y rounded-t-md rounded-b-xs outline-2 outline-offset-2 transition-[filter,outline-color] dur-fade group-hover:brightness-110 ${above ? "bg-primary" : "bg-accent-payment"} ${k === i ? "outline-text-primary" : "outline-transparent"}`}
                          style={{ height: `${Math.max(1, (x.collected / max) * 100)}%`, ...order(k) }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-6 gap-3 text-text-secondary desk:gap-6">
                  {list.map((x, k) => (
                    <div key={x.month} className={`flex flex-col items-center gap-0.5 ${k === i ? "text-text-primary" : ""}`}>
                      <span className="text-sm font-medium">{fmtMonthShort(x.month)}</span>
                      <span className="font-mono text-xs text-text-muted">{Math.round(x.collected / 1000)}b</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="m-0 text-base-sm text-text-secondary">Yeşil sütunlar tabanın üstünde, kum rengi olanlar altında kalan aylar. Bir aya dokununca yandaki özet o ayı gösterir.</p>
            </section>

            <section className="card rise flex flex-col gap-7 p-9" style={order(2)} aria-label="Seçili ay">
              <div className="flex flex-col gap-1">
                <span className="text-base-sm text-text-secondary">{fmtMonth(m.month)}</span>
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="kpi">{tl(m.collected)}</span>
                  <span className="text-base-sm text-text-secondary">/ {tl(m.floor)} taban</span>
                </div>
                <span className={`text-base-sm ${m.gap >= 0 ? "text-status-text-success" : "text-status-text-attention"}`}>
                  {m.gap >= 0 ? `Tabanın ${tl(m.gap)} üstünde` : `Tabana ${tl(-m.gap)} kaldı`}
                  {m.outstanding_due ? ` · bu ay beklenen ${tl(m.outstanding_due)}` : ""}
                </span>
              </div>
              <div className="h-meter overflow-hidden rounded-pill bg-surface-track">
                <div className={`h-full rounded-pill transition-[width] dur-rise ease-out ${m.gap >= 0 ? "bg-primary" : "bg-accent-payment"}`} style={{ width: `${m.floor ? Math.min(100, (m.collected / m.floor) * 100) : 100}%` }} />
              </div>
              {f ? (
                <div className="flex flex-col border-t border-border-default pt-2">
                  <span className="py-2 text-sm text-text-secondary">Taban nasıl hesaplanıyor (Ayarlar’dan değişir)</span>
                  {[
                    ["Bağkur", tl(f.bagkur_monthly)],
                    ["Muhasebe", tl(f.accounting_monthly)],
                    ["Diğer sabit giderler", tl(f.other_fixed_monthly)],
                    ["Hedeflenen net gelir", tl(f.target_net_monthly)],
                    ["Vergi oranı", `%${f.tax_rate_percent}`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between border-b border-border-subtle py-2 text-base">
                      <span>{l}</span>
                      <span className="font-mono text-base-sm">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-4 text-base font-semibold">
                    <span>Aylık taban</span>
                    <span className="font-mono text-base-sm">{tl(f.floor)}</span>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <section className="card rise overflow-hidden" style={order(3)} aria-label="Kaynak bazında dönüşüm">
            <div className="flex flex-wrap items-baseline gap-5 px-9 pb-2 pt-8">
              <h2 className="m-0 flex-grow text-md font-semibold">Kaynak bazında dönüşüm</h2>
              {best ? <span className="text-base-sm text-text-secondary">En iyi kaynak: {best.source}</span> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr className="text-left text-sm text-text-secondary">
                    <th className="border-b border-border-default px-5 py-4 font-medium">Kaynak</th>
                    <th className="border-b border-border-default px-5 py-4 text-right font-medium">Fırsat</th>
                    <th className="border-b border-border-default px-5 py-4 text-right font-medium">Kazanılan</th>
                    <th className="min-w-chart-height-mobile border-b border-border-default px-5 py-4 font-medium">Dönüşüm</th>
                    <th className="border-b border-border-default px-5 py-4 text-right font-medium">Kazanılan tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.data?.sources ?? []).map((r) => (
                    <tr key={r.source_id} className="transition-colors dur-hover hover:bg-surface-hover">
                      <td className="border-b border-border-subtle px-5 py-5"><Chip tone="source">{r.source}</Chip></td>
                      <td className="border-b border-border-subtle px-5 py-5 text-right font-mono text-base-sm">{r.total}</td>
                      <td className="border-b border-border-subtle px-5 py-5 text-right font-mono text-base-sm">{r.won}</td>
                      <td className="border-b border-border-subtle px-5 py-5">
                        <div className="flex items-center gap-4">
                          <div className="track flex-grow">
                            <i className={`grow-x ${r === best ? "bg-primary" : "bg-accent-opportunity"}`} style={{ width: `${(r.conversion ?? 0) * 100}%` }} />
                          </div>
                          <span className="w-control-height-md text-right font-mono text-sm">{pct(r.conversion)}</span>
                        </div>
                      </td>
                      <td className="border-b border-border-subtle px-5 py-5 text-right font-mono text-base-sm">{tl(r.won_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 px-9 py-5 text-sm text-text-muted">Dönüşüm = kazanılan / kapanan (kazanılan + kaybedilen). Açık fırsatlar hesaba girmez.</p>
          </section>
        </>
      )}
    </Page>
  );
}
