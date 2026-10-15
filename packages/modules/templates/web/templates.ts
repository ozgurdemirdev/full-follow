// Templates screen: rate tones, placeholder segments and the live render of a template for one person
import { useEffect, useState } from "react";
import { api, qs } from "@kit/api/client";
import { useIndex } from "@kit/api/keys";
import type { Template } from "@kit/api/types";
import { m } from "./messages";
import type { RenderedTemplate } from "./types";
import { channelName } from "@kit/lib/network";

/** Reply rate from which a template reads good (accent) */
export const RATE_GOOD = 0.4;
/** Reply rate from which a template reads fair (warning), below it poor (danger) */
export const RATE_FAIR = 0.25;
/** Quiet time after the last recipient pick before the render request goes out */
const RENDER_DEBOUNCE_MS = 120;
/** Page size of the templates list (every template is shown, there are few) */
/** The "Kime" row shows this many people */
export const RECIPIENTS = 3;

export type RateTone = "none" | "good" | "fair" | "poor";
export const rateTone = (rate: number | null): RateTone =>
  rate === null ? "none" : rate >= RATE_GOOD ? "good" : rate >= RATE_FAIR ? "fair" : "poor";
/** Meter fill and text colour per tone (full class names so the stylesheet keeps them) */
export const TONE_BAR: Record<RateTone, string> = { none: "bg-text-disabled", good: "bg-accent", fair: "bg-warning", poor: "bg-danger" };
export const TONE_TEXT: Record<RateTone, string> = { none: "text-text-disabled", good: "text-accent", fair: "text-warning", poor: "text-danger" };

export const meta = (t: Template) => `${t.channel ? channelName(t.channel) : m.allChannels} · ${t.sector_path ?? m.allSectors}`;

/** Tiles by reply rate, best first; templates without a measurement last */
export const byRate = (a: Template, b: Template) => (b.reply_rate ?? -1) - (a.reply_rate ?? -1);

/** Small text on the tile corner: the retire flag, or "erken" while the sample is too small to trust the rate */
export function flagOf(t: Template): { text: string; retire: boolean } | null {
  if (t.retire) return { text: m.retire, retire: true };
  return t.sent && t.early ? { text: m.early, retire: false } : null;
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

/** The people offered in the "Kime" row: the ones who need a touch first, ordered by the server (everyone is a candidate) */
export const RECIPIENTS_PATH = `/people/touch-queue${qs({ all: true, limit: RECIPIENTS })}`;

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

/** All templates (one request, shared by the screens that list them) */
export const useTemplates = () => useIndex<Template>("/templates");

/** The marketing report (served by the reports module): its template groups feed the comparison on the report page */
export const MARKETING_KEY = "/report/marketing";
