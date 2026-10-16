import { DRAFT_RULE_CHARS, DRAFT_RULES_MAX, readSetting, settingsService, truncate, type Ctx } from "@fullfollow/core";

/** The rules Claude learned from the owner's reject notes (setting `draft_rules`), oldest first; a broken stored value reads as none */
export function draftRules(ctx: Ctx): string[] {
  try {
    const list: unknown = JSON.parse(readSetting(ctx, "draft_rules") ?? "[]");
    return Array.isArray(list) ? list.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
}

/**
 * A reject note becomes a rule: appended to the list unless it is empty or already there (a reject without a reason never reaches this); the list keeps its newest rules.
 * Runs inside the transaction of the reject, so the status and the rule are written together.
 */
export function learnRule(ctx: Ctx, note: string): void {
  const rule = truncate(note, DRAFT_RULE_CHARS);
  const rules = draftRules(ctx);
  if (!rule || rules.includes(rule)) return;
  settingsService(ctx).set("draft_rules", [...rules, rule].slice(-DRAFT_RULES_MAX));
}
