// The touch stream of a company and the touches written to an address only (the network module's part of the companies screen)
import type { Comment, Company, CompanyCard, Thread, Touch } from "@kit/api/types";
import { initials } from "@kit/lib/format";
import { channelName } from "@kit/lib/network";

/** Addresses named in the line of the loose touches card */
export const LOOSE_NAMED = 3;

/** Channel of a new touch: the one used last, else e-mail when the company has an address, else other */
export const touchChannel = (card: CompanyCard | undefined, c: Company) => card?.channels[0]?.channel ?? (c.email ? "email" : "diger");

export interface StreamItem {
  key: string;
  kind: "person" | "me" | "claude";
  /** initials of the avatar */
  ini: string;
  who: string;
  at: string;
  text: string;
  touch?: Touch;
  comment?: Comment;
  thread?: Thread;
}

const CLAUDE_INI = "CL";
const ME_INI = "ÖD";

/** Touches (to the company and its people) and the comments of its threads, newest first */
export function buildStream(card: CompanyCard): StreamItem[] {
  const items: StreamItem[] = [
    ...card.touches.rows.map((t): StreamItem => {
      const name = t.person_name ?? t.company_name ?? t.to_name;
      const text = t.outcome ? `${t.summary} → ${t.outcome}` : t.summary;
      if (t.created_by === "claude") return { key: `t${t.id}`, kind: "claude", ini: CLAUDE_INI, who: `Claude · ${t.to_name}`, at: t.happened_at, text, touch: t };
      if (t.direction === "gelen") return { key: `t${t.id}`, kind: "person", ini: initials(name), who: `${name} · ${channelName(t.channel)}`, at: t.happened_at, text, touch: t };
      return { key: `t${t.id}`, kind: "me", ini: ME_INI, who: `Sen · ${t.to_name}`, at: t.happened_at, text, touch: t };
    }),
    ...card.threads.flatMap((th) => (th.comments ?? []).map((c): StreamItem => (c.created_by === "claude"
      ? { key: `c${c.id}`, kind: "claude", ini: CLAUDE_INI, who: "Claude yorumu", at: c.created_at, text: c.body, comment: c, thread: th }
      : { key: `c${c.id}`, kind: "me", ini: ME_INI, who: "Claude’a yazdın", at: c.created_at, text: c.body, comment: c, thread: th }))),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ------------------------------------------------------------ loose touches
export interface LooseGroup {
  contact: string;
  count: number;
  last: string;
  replied: boolean;
  match: NonNullable<Touch["suggested_match"]> | null;
}

/** Address-only touches grouped by address: replies first, then the newest */
export function groupLoose(rows: Touch[]): LooseGroup[] {
  const m = new Map<string, LooseGroup>();
  for (const t of rows) {
    const k = t.contact ?? "";
    const g = m.get(k) ?? { contact: k, count: 0, last: t.happened_at, replied: false, match: null };
    g.count++;
    if (t.happened_at > g.last) g.last = t.happened_at;
    if (t.direction === "gelen") g.replied = true;
    g.match ??= t.suggested_match ?? null;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => Number(b.replied) - Number(a.replied) || b.last.localeCompare(a.last));
}

/** "a, b ve c": the first addresses named, the rest counted */
export function namedAddresses(groups: LooseGroup[]): string {
  const names = groups.slice(0, LOOSE_NAMED).map((g) => g.contact);
  const rest = groups.length - names.length;
  const head = names.length > 1 ? `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}` : names[0] ?? "";
  return rest > 0 ? `${names.join(", ")} ve ${rest} adres daha` : head;
}
