import type { CSSProperties } from "react";
import type { ChatLimits, ChatMeta, ChatSession } from "../api";
import { T } from "../messages";
import { CHAT_UI } from "../constants";
import { LOCALE } from "@kit/lib/i18n";
import { fmtNum } from "@kit/lib/format";

const costFmt = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const resetFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "short", hour: "2-digit", minute: "2-digit" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const MS = 1_000;

export const fmtTokens = (n: number) => (n >= CHAT_UI.million ? T.millionTokens : T.thousandTokens(fmtNum(Math.round(n / CHAT_UI.contextUnit))));

function resetText(at: number | null): string {
  if (!at) return "";
  const d = new Date(at * MS);
  return `${T.resets}: ${d.toDateString() === new Date().toDateString() ? T.resetsToday(timeFmt.format(d)) : resetFmt.format(d)}`;
}

function Limit({ label, value, warn, danger, tip }: { label: string; value: number | null; warn: boolean; danger: boolean; tip: string }) {
  const p = value === null ? 0 : Math.round(value * 100);
  return (
    <div className="lim" tabIndex={0} data-tip={tip} data-warn={warn && !danger ? "" : undefined} data-danger={danger ? "" : undefined}>
      <span className="ring" style={{ "--p": p } as CSSProperties} />
      {label} <b className="mono">{value === null ? "–" : `%${p}`}</b>
    </div>
  );
}

export interface MeterState {
  ctxWarn: boolean;
  weekDanger: boolean;
}

/** Warning flags shared with the composer and the note under the meters */
export function meterState(session: ChatSession | null, meta: ChatMeta | null, limits: ChatLimits | null): MeterState {
  const haiku = !!session?.model.includes("haiku");
  return {
    ctxWarn: haiku && (session?.context_tokens ?? 0) > (meta?.limits.haikuPriceStepTokens ?? Infinity),
    weekDanger: (limits?.seven_day ?? 0) >= CHAT_UI.dangerLimit,
  };
}

export function Meters({ session, meta, limits, state }: { session: ChatSession | null; meta: ChatMeta | null; limits: ChatLimits | null; state: MeterState }) {
  const used = session?.context_tokens ?? 0;
  const max = meta?.models.find((m) => m.id === session?.model)?.context ?? CHAT_UI.million;
  const cost = (session?.cost_usd_micros_total ?? 0) / CHAT_UI.million;
  const tip = `${T.tokensIn}: ${fmtTokens(session?.input_tokens_total ?? 0)}\n${T.tokensOut}: ${fmtTokens(session?.output_tokens_total ?? 0)}\n${T.apiCost}: $${costFmt.format(cost)}`;
  const reading = limits ? `\n${T.lastReading}: ${timeFmt.format(new Date(limits.at))}` : "";
  const five = limits?.five_hour ?? null;
  const week = limits?.seven_day ?? null;
  return (
    <>
      <div className="meters" data-ctx-warn={state.ctxWarn ? "" : undefined}>
        <div className="ctx" tabIndex={0} data-tip={tip}>
          <span>{T.context}</span>
          <div className="ctrack"><i style={{ width: `${Math.min(100, (used / max) * 100)}%` }} /></div>
          <b className="mono">{T.contextOf(fmtTokens(used), fmtTokens(max))}</b>
        </div>
        <Limit label={T.fiveHour} value={five} warn={(five ?? 0) >= CHAT_UI.warnLimit} danger={(five ?? 0) >= CHAT_UI.dangerLimit} tip={(limits ? resetText(limits.five_resets_at) + reading : T.noReading)} />
        <Limit label={T.weekly} value={week} warn={(week ?? 0) >= CHAT_UI.warnLimit || limits?.status === "allowed_warning"} danger={state.weekDanger} tip={(limits ? resetText(limits.seven_resets_at) + reading : T.noReading)} />
      </div>
      {state.ctxWarn && <div className="ctx-note">{T.haikuWarn}</div>}
    </>
  );
}
