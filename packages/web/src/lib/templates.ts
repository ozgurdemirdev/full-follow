// Templates screen: rate tones, placeholder segments, the live render of a template for one person and the tip
import { useEffect, useState } from "react";
import { api, qs } from "../api/client";
import type { Person, RenderedTemplate, Template, TemplateGroup } from "../api/types";
import { pct, todayIso } from "./format";
import { channelName } from "./network";
import { compareTouch } from "./people";

/** Reply rate from which a template reads good (accent) */
export const RATE_GOOD = 0.4;
/** Reply rate from which a template reads fair (warning), below it poor (danger) */
export const RATE_FAIR = 0.25;
/** A template with enough sends and a rate below this gets the "emekliye ayır" flag */
export const RATE_RETIRE = 0.15;
/** Quiet time after the last recipient pick before the render request goes out */
const RENDER_DEBOUNCE_MS = 120;
/** The "Kime" row shows this many people */
export const RECIPIENTS = 3;

export type RateTone = "none" | "good" | "fair" | "poor";
export const rateTone = (rate: number | null): RateTone =>
  rate === null ? "none" : rate >= RATE_GOOD ? "good" : rate >= RATE_FAIR ? "fair" : "poor";
/** Meter fill and text colour per tone (full class names so the stylesheet keeps them) */
export const TONE_BAR: Record<RateTone, string> = { none: "bg-text-disabled", good: "bg-accent", fair: "bg-warning", poor: "bg-danger" };
export const TONE_TEXT: Record<RateTone, string> = { none: "text-text-disabled", good: "text-accent", fair: "text-warning", poor: "text-danger" };

export const meta = (t: Template) => `${t.channel ? channelName(t.channel) : "Tüm kanallar"} · ${t.sector_path ?? "Hepsi"}`;
export const shouldRetire = (t: Template) => t.reply_rate !== null && !t.early && t.reply_rate < RATE_RETIRE;

/** Tiles by reply rate, best first; templates without a measurement last */
export const byRate = (a: Template, b: Template) => (b.reply_rate ?? -1) - (a.reply_rate ?? -1);

/** Small text on the tile corner: the retire flag, or "erken" while the sample is too small to trust the rate */
export function flagOf(t: Template): { text: string; retire: boolean } | null {
  if (shouldRetire(t)) return { text: "emekliye ayır", retire: true };
  return t.sent && t.early ? { text: "erken", retire: false } : null;
}

export interface Segment {
  text: string;
  /** plain text, a placeholder that got its value, a placeholder still open */
  kind: "plain" | "filled" | "open";
}

const PLACEHOLDER = /(\{[\p{L}_]+\})/u;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The clean up core applies to a rendered text, applied to the fixed pieces of a template too */
const tidy = (s: string) => s.replace(/[ \t]{2,}/g, " ").replace(/ ,/g, ",");

/** The body as written: every {placeholder} is an open segment */
export const openSegments = (body: string): Segment[] =>
  body.split(PLACEHOLDER).filter(Boolean).map((text) => ({ text, kind: PLACEHOLDER.test(text) ? "open" : "plain" }));

/**
 * The rendered text split into what the template says and what the placeholders became. The render
 * endpoint returns plain text, so the fixed pieces of the body are matched against it; when they do not
 * line up (core tidied spacing around an empty value) the text comes back whole.
 */
export function filledSegments(body: string, rendered: string): Segment[] {
  const parts = body.split(PLACEHOLDER);
  const match = new RegExp(`^${parts.map((p, i) => (i % 2 ? "([\\s\\S]*?)" : escape(tidy(p)))).join("")}$`).exec(rendered);
  if (!match) return [{ text: rendered, kind: "plain" }];
  const out: Segment[] = [];
  parts.forEach((p, i) => {
    const text = i % 2 ? match[(i + 1) / 2] : tidy(p);
    if (!text) return;
    out.push({ text, kind: i % 2 ? (text === p ? "open" : "filled") : "plain" });
  });
  return out;
}

/** People offered in the "Kime" row: the ones who need a touch first */
export function recipients(people: Person[], today = todayIso()): Person[] {
  return [...people].sort((a, b) => compareTouch(a, b, today)).slice(0, RECIPIENTS);
}

/**
 * The template applied to one person (GET /templates/:id/render). Waits a moment after a change and
 * aborts the request a newer pick makes useless. Null until the text for exactly this pair has arrived.
 */
export function useRendered(templateId: number, personId: number | null): string | null {
  const [done, setDone] = useState<{ key: string; body: string } | null>(null);
  const key = `${templateId}:${personId}`;
  useEffect(() => {
    if (!personId) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      api.get<RenderedTemplate>(`/templates/${templateId}/render${qs({ person_id: personId })}`, abort.signal)
        .then((r) => setDone({ key, body: r.body }))
        .catch(() => {});
    }, RENDER_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [templateId, personId, key]);
  return personId && done?.key === key ? done.body : null;
}

/**
 * Gap G19: one sentence about a template, derived from the comparison of its group (same kind and channel).
 * This rule moves into core next to templateComparison() with the templates module; the web only renders it.
 */
export function templateTip(t: Template, groups: TemplateGroup[]): string | null {
  if (!t.sent) return "Henüz ölçüm yok. Bir taslakta kullanıp gönderince cevap oranı burada görünür.";
  const group = groups.find((g) => g.kind === t.kind && g.channel === t.channel)?.templates ?? [];
  const mine = group.find((x) => x.id === t.id);
  if (shouldRetire(t)) {
    const best = group.filter((x) => x.id !== t.id && !x.early && x.reply_rate !== null && x.reply_rate > t.reply_rate!).sort((a, b) => b.reply_rate! - a.reply_rate!)[0];
    const own = `Bu şablon ${t.sent} kez gitti, ${t.replied} cevap aldı.`;
    return best ? `${own} Aynı tür ve kanalda “${best.name}” ${pct(best.reply_rate)} cevap alıyor. Bunu arşive kaldırmanı öneririm.` : `${own} Bunu arşive kaldırmanı öneririm.`;
  }
  if (t.early) return "Gönderimi az olduğu için oranı henüz güvenilir değil.";
  return mine?.leader ? `Aynı tür ve kanalda en yüksek cevap oranı bu şablonda (${pct(t.reply_rate)}).` : null;
}
