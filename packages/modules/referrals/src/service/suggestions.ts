import { addDays, daysBetween, LOCALE, type Ctx, type ReferralSuggestion, type ReferralSuggestions } from "@fullfollow/core";
import { m } from "../messages";
import { ALL_ROWS, ASK_RECENT_DAYS, DELIVERED_STAGES, ISO_DATE_LENGTH, LATE_PAYMENT, SUGGESTIONS_SHOWN, THANKS_RECENT_DAYS } from "./constants";

type Kind = keyof typeof m.requestTitle;

const tl = (n: number) => `${m.lira}${n.toLocaleString(LOCALE)}`;

/**
 * "Teşekkür zamanı" and "Kimden referans istenir". The tree comes from the people module, the won opportunities from the pipeline module,
 * the projects and their late payments from the projects module; a list whose module is missing is empty. The state of a row ("asked":
 * a task for Claude is open, "drafted": a draft waits) comes from the calendar and drafts modules and stays "idle" without them.
 */
export function referralSuggestions(ctx: Ctx): ReferralSuggestions {
  const today = ctx.clock.today();
  const tree = ctx.mod("people")?.referralTree() ?? [];
  const byId = new Map(tree.map((p) => [p.id, p]));
  const introducers = new Set(tree.flatMap((p) => (p.referred_by_id ? [p.referred_by_id] : [])));

  const drafted = new Set(ctx.mod("drafts")?.list({ filter: { status: "bekliyor" }, limit: ALL_ROWS }).rows.flatMap((d) => (d.person_id ? [d.person_id] : [])));
  const asked = new Set(ctx.mod("calendar")?.tasks.list({ filter: { assignee: "claude" }, limit: ALL_ROWS }).rows.map((t) => `${t.person_id}:${t.title}`));
  const row = (kind: Kind, person: { id: number; name: string }, why: string, ready: boolean): ReferralSuggestion => {
    const request_title = m.requestTitle[kind](person.name);
    return {
      person: { id: person.id, name: person.name }, why, ready, request_title,
      state: !ready ? "idle" : drafted.has(person.id) ? "drafted" : asked.has(`${person.id}:${request_title}`) ? "asked" : "idle",
    };
  };

  // whoever introduced a person whose opportunity was won recently, newest first, once per introducer
  const thanks: ReferralSuggestion[] = [];
  const since = addDays(today, -THANKS_RECENT_DAYS);
  const won = (ctx.mod("pipeline")?.opportunities.list({ filter: { stage: "kazanildi" }, limit: ALL_ROWS }).rows ?? [])
    .map((o) => ({ o, at: (o.closed_at ?? o.updated_at).slice(0, ISO_DATE_LENGTH) }))
    .filter(({ at }) => at >= since)
    .sort((a, b) => b.at.localeCompare(a.at));
  const thanked = new Set<number>();
  for (const { o } of won) {
    const referrer = byId.get(byId.get(o.person_id)?.referred_by_id ?? 0);
    if (!referrer || thanked.has(referrer.id)) continue;
    thanked.add(referrer.id);
    thanks.push(row("thanks", referrer, m.why.thanks(o.company_name ?? o.person_name, o.estimated_value ? tl(o.estimated_value) : null), true));
    if (thanks.length === SUGGESTIONS_SHOWN) break;
  }

  // delivered and paid up, nobody introduced yet; a late payment shows the person without a button
  const projects = ctx.mod("projects");
  const late = new Map<number, number>();
  for (const p of projects?.payments.list({ filter: { status: LATE_PAYMENT }, limit: ALL_ROWS }).rows ?? []) {
    if (!late.has(p.project_id)) late.set(p.project_id, p.expected_amount - p.paid_amount);
  }
  const delivered = (projects?.projects.list({ limit: ALL_ROWS }).rows ?? [])
    .filter((p) => DELIVERED_STAGES.includes(p.stage))
    .map((p) => ({ p, ago: daysBetween((p.delivered_at ?? p.updated_at).slice(0, ISO_DATE_LENGTH), today) }))
    .filter(({ ago }) => ago >= 0 && ago <= ASK_RECENT_DAYS)
    .sort((a, b) => a.ago - b.ago);
  const rows: ReferralSuggestion[] = [];
  const asking = new Set<number>();
  for (const { p, ago } of delivered) {
    const person = byId.get(p.person_id);
    if (!person || introducers.has(person.id) || asking.has(person.id)) continue;
    const owed = late.get(p.id);
    if (owed !== undefined) {
      asking.add(person.id);
      rows.push(row("ask", person, m.why.askLate(tl(owed)), false));
    } else if (p.paid_total > 0 && p.paid_total >= (p.expected_total || p.price)) {
      asking.add(person.id);
      rows.push(row("ask", person, m.why.askReady(p.name, ago <= 0 ? m.why.today : m.why.daysAgo(ago)), true));
    }
  }
  const asks = [...rows.filter((r) => r.ready), ...rows.filter((r) => !r.ready)].slice(0, SUGGESTIONS_SHOWN);
  return { thanks, asks };
}
