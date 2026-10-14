import type { Thread } from "../api/types";
import { linkTo } from "../app/modules/links";
import { TARGET } from "./labels";

/** Where a thread stands, from Özgür's side (the states of the Comments board) */
export type CState = "you" | "answered" | "answered_seen" | "claude" | "closed";
export type CTab = "open" | "you" | "claude" | "closed";

/** Threads drawn at once; the rest comes with "daha" so a long history does not render in one go */
export const THREADS_SHOWN = 24;
/** Recent records offered as targets of a new thread */
export const TARGETS_SHOWN = 5;

export const TABS: { key: CTab; label: string; dot: string; states: CState[]; empty: string }[] = [
  { key: "open", label: "Açık", dot: "bg-text-primary", states: ["you", "answered", "answered_seen"], empty: "Açık konu yok." },
  { key: "you", label: "Sana soruldu", dot: "bg-warning", states: ["you"], empty: "Claude senden bir şey beklemiyor." },
  { key: "claude", label: "Claude’da", dot: "bg-claude-soft", states: ["claude"], empty: "Claude’da bekleyen konu yok, hepsine cevap verdi." },
  { key: "closed", label: "Kapandı", dot: "bg-text-disabled", states: ["closed"], empty: "Kapanan konu yok." },
];

/** State chip text and colours (Tailwind classes written out in full so they are scanned) */
export const STATE_CHIP: Record<CState, { label: string; cls: string }> = {
  you: { label: "Sana soruldu", cls: "bg-chip-payment-bg text-warning" },
  answered: { label: "Yeni cevap", cls: "bg-accent-soft-bg text-accent" },
  answered_seen: { label: "Cevaplandı", cls: "bg-surface-track-alt text-text-secondary" },
  claude: { label: "Claude’da", cls: "bg-claude-bg text-claude-soft" },
  closed: { label: "Kapandı", cls: "bg-surface-2 text-text-disabled" },
};

/** Record kinds as the board names them, with the dot colour; other target types use the shared label */
const KIND: Record<string, { label: string; dot: string }> = {
  project: { label: TARGET.project, dot: "bg-warning" },
  person: { label: TARGET.person, dot: "bg-entity-person" },
  company: { label: TARGET.company, dot: "bg-entity-source" },
  own_project: { label: "Kendi projem", dot: "bg-claude" },
  opportunity: { label: TARGET.opportunity, dot: "bg-claude-soft" },
  task: { label: TARGET.task, dot: "bg-entity-task" },
  payment: { label: TARGET.payment, dot: "bg-entity-payment" },
};
export const kindOf = (type: string) => KIND[type] ?? { label: TARGET[type] ?? type, dot: "bg-entity-neutral" };

/** Page of the record a thread is about, null when it has none */
export const targetHref = (t: Pick<Thread, "target_type" | "target_id">) => linkTo(t.target_type, t.target_id);

/** What the old filters sent in `?f=` (the dashboard links with `mine`) and the tab each belongs to */
const FILTER_TAB: Record<string, CTab> = { open: "open", mine: "you", claude: "claude", all: "open" };
export const tabFromQuery = (search: string): CTab => FILTER_TAB[new URLSearchParams(search).get("f") ?? ""] ?? "open";

/** Quick answer chips of the last comment (`comments.options`, set by Claude when it asks) */
export const optionsOf = (t: Thread): string[] => t.comments?.at(-1)?.options ?? [];

/**
 * Last word from Özgür: "Claude'da". Last word from Claude: "Sana soruldu" when it asked (chips, or Claude opened the
 * thread), otherwise a reply to Özgür's own question: "Yeni cevap" while unread (`read_at`), "Cevaplandı" after.
 * `seen` holds threads opened in this session whose read mark is still on its way.
 */
export function stateOf(t: Thread, seen: ReadonlySet<number>): CState {
  if (t.resolved_at) return "closed";
  if (t.last_by === "ozgur") return "claude";
  if (optionsOf(t).length || t.comments?.[0]?.created_by === "claude") return "you";
  return t.comments?.at(-1)?.read_at || seen.has(t.id) ? "answered_seen" : "answered";
}

const NONE_SEEN: ReadonlySet<number> = new Set();
/** The tab a closed thread lands in once it is reopened */
export const reopenTab = (t: Thread): CTab => TABS.find((x) => x.states.includes(stateOf({ ...t, resolved_at: null }, NONE_SEEN)))!.key;

export interface Target {
  type: string;
  id: number;
  label: string;
}

/** The most recently active records, from the threads already loaded */
export function recentTargets(threads: readonly Thread[], limit = TARGETS_SHOWN): Target[] {
  const seen = new Set<string>();
  const out: Target[] = [];
  for (const t of threads) {
    const k = `${t.target_type}:${t.target_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: t.target_type, id: t.target_id, label: t.target_label });
    if (out.length === limit) break;
  }
  return out;
}
