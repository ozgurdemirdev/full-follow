import { z } from "zod";
import type { McpDef, McpFormat } from "@fullfollow/core";
import { CHANNEL_PERFORMANCE_DAYS, MCP_REFERRALS, MCP_TEMPLATE_NAME_LENGTH } from "./constants";
import { m } from "./messages";

type Row = Record<string, any>;

const PERCENT = 100;
/** The period of a funnel as the lines name it: "tümü" for all, else the days with a "g" */
const periodText = (period: string | number) => (period === "all" ? m.mcp.periodAll : m.mcp.periodDays(period));

/** The marketing part of the report: core's line (the channels) and the lines the installed modules contribute, sorted by `at` */
function marketingText(mk: any, f: McpFormat): string {
  const channels = { at: 400, lines: mk.channels.length ? [m.mcp.channels(CHANNEL_PERFORMANCE_DAYS, mk.channels.map((c: Row) => `${f.label(c.channel)} ${c.replied}/${c.people}`).join(" · "))] : [] };
  return [channels, ...f.marketingParts().map((p) => ({ at: p.at, lines: p.render(mk, f) }))]
    .sort((a, b) => a.at - b.at)
    .flatMap((p) => p.lines)
    .join("\n");
}

/** One line: `Kaynak (90g): R10 40→22→6→2→1→0 zayıf · Ajans 12→9→3→1→0→0 erken` (found → written → replied → meeting → offer → won) */
function sourceFunnelText(s: any): string {
  if (!s?.sources.length) return "";
  const flag = (x: Row) => (x.weak ? m.mcp.weak : x.early ? m.mcp.early : "");
  return m.mcp.sourceFunnel(periodText(s.period), s.sources.map((x: Row) => `${x.source} ${x.steps.map((st: Row) => st.count).join("→")}${flag(x)}`).join(" · "));
}

export function reportText(r: any, f: McpFormat): string {
  const src = r.sources.length
    ? r.sources.map((s: Row) => f.join(s.source, m.mcp.sourceTotal(s.total), m.mcp.sourceOutcome(s.won, s.lost, s.open), s.conversion === null ? m.mcp.noConversion : m.mcp.conversion(Math.round(s.conversion * PERCENT)), s.won_value ? m.mcp.wonValue(f.tl(s.won_value)) : "")).join("\n")
    : m.mcp.noSources;
  const month = r.month;
  const gap = `${month.gap >= 0 ? "+" : ""}${f.tl(month.gap)}`;
  const w = r.week?.this_week;
  const week = w ? m.mcp.weekLine(w.sent, w.replies, w.reply_rate, w.meetings, w.new_people) : "";
  const refs = r.referrals?.length ? m.mcp.referrals(r.referrals.slice(0, MCP_REFERRALS).map((x: Row) => m.mcp.referralItem(x.name, x.network, x.won, f.tl(x.won_value))).join(" · ")) : "";
  const mk = r.marketing ? marketingText(r.marketing, f) : "";
  const funnel = sourceFunnelText(r.source_funnel);
  return `${week}${refs}${mk ? `${mk}\n` : ""}${funnel ? `${funnel}\n` : ""}${src}\n${m.mcp.month(month.month, f.tl(month.collected), f.tl(month.floor), gap, month.outstanding_due ? f.tl(month.outstanding_due) : undefined)}${month.insight ? `\n${month.insight}` : ""}`;
}

const pctText = (r: number | null | undefined) => (r === null || r === undefined ? "–" : `%${Math.round(r * PERCENT)}`);

/** Weekly review (report with week): header, counts against last week, template and source highlights, limit overruns, suggestions */
export function reviewText(r: any, f: McpFormat): string {
  const w = r.this_week;
  const l = r.last_week;
  const target = r.target ? m.mcp.target(r.target) : "";
  const tpl = r.templates.map((g: Row) => `${f.label(g.kind)}/${g.channel ? f.label(g.channel) : m.mcp.allChannels}: ${[
    g.leader ? m.mcp.leader(f.cut(g.leader.name, MCP_TEMPLATE_NAME_LENGTH), pctText(g.leader.reply_rate)) : "",
    g.loser ? m.mcp.loser(f.cut(g.loser.name, MCP_TEMPLATE_NAME_LENGTH), pctText(g.loser.reply_rate)) : "",
    g.early ? m.mcp.earlyCount(g.early) : "",
  ].filter(Boolean).join(", ")}`);
  const src = [r.sources.best && m.mcp.best(r.sources.best.source, pctText(r.sources.best.reply_rate)), r.sources.weakest && m.mcp.weakest(r.sources.weakest.source, pctText(r.sources.weakest.reply_rate))].filter(Boolean);
  const full = r.quota.filter((c: Row) => c.over_days).map((c: Row) => m.mcp.quotaFull(f.label(c.channel), c.over_days, c.limit));
  return [
    m.mcp.reviewHeader(r.week, f.d(r.start), f.d(r.end)),
    m.mcp.counts({ sent: w.sent, replies: w.replies, meetings: w.meetings, offers: w.offers, newPeople: w.new_people, newCompanies: w.new_companies }, target, l.sent, pctText(w.reply_rate), pctText(l.reply_rate), l.new_people + l.new_companies),
    tpl.length ? m.mcp.template(tpl.join(" | ")) : "",
    src.length ? m.mcp.sourceFunnel(periodText(r.sources.period), src.join(" · ")) : "",
    full.length ? m.mcp.limitFull(full.join(" · ")) : "",
    m.mcp.suggestionsHead,
    ...r.suggestions.map((x: Row, i: number) => `  ${i + 1}. ${x.text}`),
  ].filter(Boolean).join("\n");
}

/** The `report` tool: month report and marketing numbers, or with `week` the weekly review. Its description is assembled from the fragments of every module (`docs.report`). */
export const mcp: McpDef = {
  tools: [{
    name: "report",
    description: [
      { at: 120, text: m.mcp.reportDocStart },
      { at: 202, text: m.mcp.reportDoc },
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
