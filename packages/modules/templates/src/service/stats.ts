import {
  CHANNELS, keptRows, NO_SECTOR_LABEL, REPLIED_AFTER, subjectInfo, TEMPLATE_KINDS, TEMPLATE_MIN_SAMPLE,
  type Ctx, type Subject, type TemplateGroup, type TemplateStats, type TemplateSuggestion,
} from "@fullfollow/core";

/**
 * Every template with how it did: drafts made from it (used), sent ones, and sent ones that got a later reply.
 * The drafts and touches tables are read directly: they always exist, and sent drafts keep counting when the drafts module is switched off.
 */
export function templateStats(ctx: Ctx): TemplateStats[] {
  return keptRows(ctx, `
    SELECT t.*, s.name AS sector_name, ps.name AS sector_parent,
      (SELECT COUNT(*) FROM drafts d WHERE d.template_id = t.id) AS used,
      (SELECT COUNT(*) FROM drafts d WHERE d.template_id = t.id AND d.status = 'gonderildi') AS sent,
      (SELECT COUNT(*) FROM drafts d JOIN touches x ON x.draft_id = d.id WHERE d.template_id = t.id AND ${REPLIED_AFTER}) AS replied
    FROM templates t LEFT JOIN sectors s ON s.id = t.sector_id LEFT JOIN sectors ps ON ps.id = s.parent_id
    ORDER BY t.kind, t.name COLLATE NOCASE`)
    .map(({ sector_parent, ...t }): TemplateStats => ({
      ...t,
      sector_path: t.sector_name ? (sector_parent ? `${sector_parent} > ${t.sector_name}` : t.sector_name) : null,
      reply_rate: t.sent ? t.replied / t.sent : null,
      early: t.sent < TEMPLATE_MIN_SAMPLE,
    }));
}

/**
 * Per template, sent messages by the recipient's sector (the person's, else the company's; the lowest sector id
 * when there are several; none = NO_SECTOR_LABEL). Same sent and replied rules as templateStats.
 */
function sectorBreakdown(ctx: Ctx) {
  const list = keptRows<{ template_id: number; sector_path: string | null; sent: number; replied: number }>(ctx, `
    SELECT b.template_id, CASE WHEN s.id IS NULL THEN NULL WHEN ps.name IS NULL THEN s.name ELSE ps.name || ' > ' || s.name END AS sector_path,
      COUNT(*) AS sent, SUM(b.replied) AS replied
    FROM (
      SELECT d.template_id, ${REPLIED_AFTER} AS replied, COALESCE(
        (SELECT MIN(sector_id) FROM person_sectors WHERE person_id = x.person_id),
        (SELECT MIN(sector_id) FROM company_sectors WHERE company_id = COALESCE(x.company_id, (SELECT company_id FROM people WHERE id = x.person_id)))) AS sector_id
      FROM drafts d JOIN touches x ON x.draft_id = d.id WHERE d.template_id IS NOT NULL AND d.status = 'gonderildi'
    ) b LEFT JOIN sectors s ON s.id = b.sector_id LEFT JOIN sectors ps ON ps.id = s.parent_id
    GROUP BY b.template_id, s.id ORDER BY sent DESC, sector_path`);
  const by = new Map<number, TemplateGroup["templates"][number]["sectors"]>();
  for (const r of list) {
    const items = by.get(r.template_id) ?? [];
    items.push({ sector_path: r.sector_path ?? NO_SECTOR_LABEL, sent: r.sent, replied: r.replied, reply_rate: r.replied / r.sent, early: r.sent < TEMPLATE_MIN_SAMPLE });
    by.set(r.template_id, items);
  }
  return by;
}

/**
 * A/B comparison: sent templates grouped by kind and channel (null channel = all channels). Inside a group
 * templates with enough sample come first by reply rate, early ones after. `leader` is set only when at least
 * two templates in the group have enough sample and the best rate is strictly higher than the next one.
 */
export function templateComparison(ctx: Ctx): TemplateGroup[] {
  const sectors = sectorBreakdown(ctx);
  const groups = new Map<string, { kind: TemplateStats["kind"]; channel: TemplateStats["channel"]; list: TemplateStats[] }>();
  for (const t of templateStats(ctx).filter((x) => x.sent)) {
    const key = `${t.kind}/${t.channel ?? ""}`;
    const g = groups.get(key) ?? { kind: t.kind, channel: t.channel, list: [] as TemplateStats[] };
    g.list.push(t);
    groups.set(key, g);
  }
  const slot = (g: { kind: string; channel: string | null }) =>
    TEMPLATE_KINDS.indexOf(g.kind as never) * (CHANNELS.length + 1) + (g.channel ? CHANNELS.indexOf(g.channel as never) : CHANNELS.length);
  return [...groups.values()].sort((a, b) => slot(a) - slot(b)).map((g) => {
    const ranked = g.list.sort((a, b) => Number(a.early) - Number(b.early) || b.reply_rate! - a.reply_rate! || b.sent - a.sent);
    const [first, second] = ranked;
    const leaderId = second && !second.early && first.reply_rate! > second.reply_rate! ? first.id : null;
    return {
      kind: g.kind,
      channel: g.channel,
      templates: ranked.map((t) => ({
        id: t.id, name: t.name, sent: t.sent, replied: t.replied, reply_rate: t.reply_rate, early: t.early,
        leader: t.id === leaderId, sectors: sectors.get(t.id) ?? [],
      })),
    };
  });
}

/**
 * Muhatap (kişi ya da firma) ve kanala uyan şablonlar, en uygun önce: aynı kanal > tüm kanallar;
 * aynı alt sektör > ana sektör > tüm sektörler (muhatabın sektörlerinden en iyi eşleşen).
 * Başka kanala ya da başka sektöre yazılmış şablon gelmez. `kind` verilirse sadece o tür.
 */
export function suggestTemplates(ctx: Ctx, subject: Subject, channel?: string | null, kind?: string | null): TemplateSuggestion[] {
  const secs = subjectInfo(ctx, subject)?.sectors ?? [];
  const sectorScore = (sid: number) => Math.max(-1, ...secs.map((s) => (s.id === sid ? 4 : s.parent_id === sid ? 3 : -1)));
  return templateStats(ctx)
    .filter((t) => !kind || t.kind === kind)
    .map((t) => {
      const ch = !t.channel ? 1 : t.channel === channel ? 4 : -1;
      const se = !t.sector_id ? 1 : sectorScore(t.sector_id);
      return { ...t, score: ch < 0 || se < 0 ? -1 : ch + se };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || (b.reply_rate ?? 0) - (a.reply_rate ?? 0) || b.used - a.used);
}
