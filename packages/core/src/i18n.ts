// The one place that names the language of everything a person reads: server messages, MCP output and (through the
// web kit's re-export) the web. Pure: no imports, so the web bundles this file as it is.

/** Language of the texts; a second language is a second key in every `defineMessages` call */
export const LANG = "tr" as const;
/** Locale of every number, money and date formatter */
export const LOCALE = "tr-TR";

export type Lang = typeof LANG;
/** A message is fixed text, or a function for text with values in it (counts, names) */
export type Message = string | ((...args: never[]) => string);
export type Messages = Record<string, Message | Record<string, Message>>;

/**
 * A module's or a screen's texts, one object per language; the Turkish one is required and gives the keys their types.
 * `const m = defineMessages({ tr: { save: "Kaydet", late: (days: number) => `${days} gün gecikti` } })` then `m.save`, `m.late(3)`.
 */
export function defineMessages<M extends Messages>(byLang: { tr: M } & Partial<Record<string, M>>): M {
  return (byLang as Record<string, M | undefined>)[LANG] ?? byLang.tr;
}
