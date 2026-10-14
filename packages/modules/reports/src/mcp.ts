import { z } from "zod";
import type { McpDef, McpFormat } from "@fullfollow/core";

type Row = Record<string, any>;

/** The marketing part of the report: core's line (the channels) and the lines the installed modules contribute, sorted by `at` */
function marketingText(m: any, f: McpFormat): string {
  const channels = { at: 400, lines: m.channels.length ? [`Kanal (30 gün, kişi): ${m.channels.map((c: Row) => `${f.label(c.channel)} ${c.replied}/${c.people}`).join(" · ")}`] : [] };
  return [channels, ...f.marketingParts().map((p) => ({ at: p.at, lines: p.render(m, f) }))]
    .sort((a, b) => a.at - b.at)
    .flatMap((p) => p.lines)
    .join("\n");
}

/** One line: `Kaynak (90g): R10 40→22→6→2→1→0 zayıf · Ajans 12→9→3→1→0→0 erken` (found → written → replied → meeting → offer → won) */
function sourceFunnelText(s: any): string {
  if (!s?.sources.length) return "";
  const flag = (x: Row) => (x.weak ? " zayıf" : x.early ? " erken" : "");
  return `Kaynak (${s.period === "all" ? "tümü" : `${s.period}g`}): ${s.sources.map((x: Row) => `${x.source} ${x.steps.map((st: Row) => st.count).join("→")}${flag(x)}`).join(" · ")}`;
}

export function reportText(r: any, f: McpFormat): string {
  const src = r.sources.length
    ? r.sources.map((s: Row) => f.join(s.source, `${s.total} fırsat`, `${s.won} kazanıldı/${s.lost} kayıp/${s.open} açık`, s.conversion === null ? "dönüşüm –" : `dönüşüm %${Math.round(s.conversion * 100)}`, s.won_value ? `kazanılan ${f.tl(s.won_value)}` : "")).join("\n")
    : "kaynak yok";
  const m = r.month;
  const gap = `${m.gap >= 0 ? "+" : ""}${f.tl(m.gap)}`;
  const w = r.week?.this_week;
  const week = w ? `Bu hafta: ${w.sent} giden · ${w.replies} dönüş${w.reply_rate !== null ? ` (%${Math.round(w.reply_rate * 100)})` : ""} · ${w.meetings} görüşme · ${w.new_people} yeni kişi\n` : "";
  const refs = r.referrals?.length ? `Referans: ${r.referrals.slice(0, 5).map((x: Row) => `${x.name} ${x.network} kişi, ${x.won} kazanıldı ${f.tl(x.won_value)}`).join(" · ")}\n` : "";
  const mk = r.marketing ? marketingText(r.marketing, f) : "";
  const funnel = sourceFunnelText(r.source_funnel);
  return `${week}${refs}${mk ? `${mk}\n` : ""}${funnel ? `${funnel}\n` : ""}${src}\n${m.month}: tahsilat ${f.tl(m.collected)} · taban ${f.tl(m.floor)} · fark ${gap}${m.outstanding_due ? ` · vadesi bu ayda kalan ${f.tl(m.outstanding_due)}` : ""}${m.insight ? `\n${m.insight}` : ""}`;
}

const pctText = (r: number | null | undefined) => (r === null || r === undefined ? "–" : `%${Math.round(r * 100)}`);

/** Weekly review (report with week): header, counts against last week, template and source highlights, limit overruns, suggestions */
export function reviewText(r: any, f: McpFormat): string {
  const w = r.this_week;
  const l = r.last_week;
  const target = r.target ? `/${r.target} hedef` : "";
  const tpl = r.templates.map((g: Row) => `${f.label(g.kind)}/${g.channel ? f.label(g.channel) : "tüm kanallar"}: ${[
    g.leader ? `"${f.cut(g.leader.name, 25)}" önde ${pctText(g.leader.reply_rate)}` : "",
    g.loser ? `"${f.cut(g.loser.name, 25)}" geride ${pctText(g.loser.reply_rate)}` : "",
    g.early ? `${g.early} erken` : "",
  ].filter(Boolean).join(", ")}`);
  const src = [r.sources.best && `en iyi ${r.sources.best.source} ${pctText(r.sources.best.reply_rate)}`, r.sources.weakest && `zayıf ${r.sources.weakest.source} ${pctText(r.sources.weakest.reply_rate)}`].filter(Boolean);
  const full = r.quota.filter((c: Row) => c.over_days).map((c: Row) => `${f.label(c.channel)} ${c.over_days} gün (limit ${c.limit})`);
  return [
    `HAFTALIK İNCELEME ${r.week} (${f.d(r.start)} → ${f.d(r.end)})`,
    `Giden ${w.sent}${target} (geçen ${l.sent}) · dönüş ${w.replies} ${pctText(w.reply_rate)} (geçen ${pctText(l.reply_rate)}) · görüşme ${w.meetings} · teklif ${w.offers} · yeni ${w.new_people} kişi, ${w.new_companies} firma (geçen ${l.new_people + l.new_companies})`,
    tpl.length ? `Şablon: ${tpl.join(" | ")}` : "",
    src.length ? `Kaynak (${r.sources.period === "all" ? "tümü" : `${r.sources.period}g`}): ${src.join(" · ")}` : "",
    full.length ? `Limit doldu: ${full.join(" · ")}` : "",
    "Gelecek hafta için öneriler:",
    ...r.suggestions.map((x: Row, i: number) => `  ${i + 1}. ${x.text}`),
  ].filter(Boolean).join("\n");
}

/** The `report` tool: month report and marketing numbers, or with `week` the weekly review. Its description is assembled from the fragments of every module (`docs.report`). */
export const mcp: McpDef = {
  tools: [{
    name: "report",
    description: [
      { at: 120, text: "pazarlama (" },
      { at: 202, text: "kanal dönüşü), kaynak hunisi (bulundu→yazıldı→cevap→görüşme→teklif→kazanıldı, son 90 gün; zayıf/erken işaretli), kaynak dönüşümü, ayın tahsilatı vs fiyat tabanı. month: YYYY-MM. week: YYYY-Www, haftadan bir tarih ya da \"bu\" verilirse rapor yerine o haftanın incelemesi (Cuma özeti): giden/hedef, dönüş oranı, görüşme, teklif, yeni kayıt, şablon ve kaynak öne çıkanları, limit aşımı, gelecek hafta için 2-4 öneri." },
    ],
    input: { month: z.string().optional(), week: z.string().optional() },
    run: (ctx, { month, week }: { month?: string; week?: string }, f) => {
      const reports = ctx.mod("reports")!;
      return week
        ? reviewText(reports.review(week === "bu" ? undefined : week), f)
        : reportText({ ...reports.report(month), week: ctx.mod("network")?.weekStats(), referrals: ctx.mod("referrals")?.report() ?? [], marketing: reports.marketing(), source_funnel: reports.sourceFunnel() }, f);
    },
  }],
};
