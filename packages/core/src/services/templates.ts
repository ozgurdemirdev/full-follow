import { eq } from "drizzle-orm";
import { CHANNELS, NO_SECTOR_LABEL, TEMPLATE_KINDS, TEMPLATE_MIN_SAMPLE } from "../constants";
import { emit, FFError, parse, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { templates } from "../db/schema";
import { templateCreate, templateUpdate } from "../schemas";
import { ensureSector } from "./sectors";
import { requireRow, truncate } from "./shared";
import { subjectInfo, type Subject } from "./subject";
import { Bin } from "./trash";

/**
 * Şablondaki yer tutucular: {ad} {ad_soyad} {firma} {sektor}. Bilinmeyen yer tutucu olduğu gibi kalır.
 * Firmaya giden mesajda {ad} ve {firma} firma adıdır; sadece adrese giden mesajda {ad} boş kalır.
 */
export function renderTemplate(ctx: Ctx, body: string, subject: Subject): string {
  const p = subjectInfo(ctx, subject);
  if (!p) return body;
  const sector = p.sectors[0]?.name ?? "";
  const vals: Record<string, string> = { ad: p.first, ad_soyad: p.name, firma: p.company, sektor: sector, sektör: sector };
  return body.replace(/\{(\w+|sektör)\}/g, (m, k: string) => (k in vals ? vals[k] : m)).replace(/[ \t]{2,}/g, " ").replace(/ ,/g, ",");
}

/** Girdideki `sector` ("Sağlık > Diş hekimi") → sector_id */
function withSector(q: Q, ctx: Ctx, input: unknown): unknown {
  if (!input || typeof input !== "object" || !("sector" in input)) return input;
  const { sector, ...rest } = input as Record<string, any>;
  return rest.sector_id !== undefined ? rest : { ...rest, sector_id: ensureSector(q, ctx, sector ?? null) };
}

/** SQL: touch `x` (a sent message) got a later incoming touch from the same person, company or bare contact */
const REPLIED_AFTER = `EXISTS (
  SELECT 1 FROM touches g WHERE g.direction = 'gelen' AND g.happened_at > x.happened_at AND (g.person_id = x.person_id
    OR (x.person_id IS NULL AND g.company_id = x.company_id) OR (x.person_id IS NULL AND x.company_id IS NULL AND g.contact_key = x.contact_key)))`;

/**
 * Şablon listesi + başarı: kaç taslakta kullanıldı, kaçı gönderildi, gönderilenlerden kaçına sonra cevap geldi.
 * `early`: örnek az (gönderim < TEMPLATE_MIN_SAMPLE), oran güvenilir değil.
 */
export function templateStats(ctx: Ctx) {
  return rows(ctx, `
    SELECT t.*, s.name AS sector_name, ps.name AS sector_parent,
      (SELECT COUNT(*) FROM drafts d WHERE d.template_id = t.id) AS used,
      (SELECT COUNT(*) FROM drafts d WHERE d.template_id = t.id AND d.status = 'gonderildi') AS sent,
      (SELECT COUNT(*) FROM drafts d JOIN touches x ON x.draft_id = d.id WHERE d.template_id = t.id AND ${REPLIED_AFTER}) AS replied
    FROM templates t LEFT JOIN sectors s ON s.id = t.sector_id LEFT JOIN sectors ps ON ps.id = s.parent_id
    ORDER BY t.kind, t.name COLLATE NOCASE`)
    .map(({ sector_parent, ...t }) => ({
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
  const list = rows<{ template_id: number; sector_path: string | null; sent: number; replied: number }>(ctx, `
    SELECT b.template_id, CASE WHEN s.id IS NULL THEN NULL WHEN ps.name IS NULL THEN s.name ELSE ps.name || ' > ' || s.name END AS sector_path,
      COUNT(*) AS sent, SUM(b.replied) AS replied
    FROM (
      SELECT d.template_id, ${REPLIED_AFTER} AS replied, COALESCE(
        (SELECT MIN(sector_id) FROM person_sectors WHERE person_id = x.person_id),
        (SELECT MIN(sector_id) FROM company_sectors WHERE company_id = COALESCE(x.company_id, (SELECT company_id FROM people WHERE id = x.person_id)))) AS sector_id
      FROM drafts d JOIN touches x ON x.draft_id = d.id WHERE d.template_id IS NOT NULL AND d.status = 'gonderildi'
    ) b LEFT JOIN sectors s ON s.id = b.sector_id LEFT JOIN sectors ps ON ps.id = s.parent_id
    GROUP BY b.template_id, s.id ORDER BY sent DESC, sector_path`);
  const by = new Map<number, { sector_path: string; sent: number; replied: number; reply_rate: number; early: boolean }[]>();
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
export function templateComparison(ctx: Ctx) {
  const sectors = sectorBreakdown(ctx);
  const groups = new Map<string, { kind: string; channel: string | null; list: ReturnType<typeof templateStats> }>();
  for (const t of templateStats(ctx).filter((x) => x.sent)) {
    const key = `${t.kind}/${t.channel ?? ""}`;
    const g = groups.get(key) ?? { kind: t.kind, channel: t.channel, list: [] as ReturnType<typeof templateStats> };
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
export function suggestTemplates(ctx: Ctx, subject: Subject, channel?: string | null, kind?: string | null) {
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

export function templatesService(ctx: Ctx) {
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const d = parse(templateCreate, withSector(tx, ctx, input));
      if (d.sector_id) requireRow(ctx, "sectors", d.sector_id, "sektör");
      const r = tx.insert(templates).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "template.created", summary: `Şablon eklendi: ${truncate(d.name, 60)}`, data: { template_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const d = parse(templateUpdate, withSector(tx, ctx, input));
      const cur = requireRow(ctx, "templates", id);
      if (d.sector_id) requireRow(ctx, "sectors", d.sector_id, "sektör");
      if (Object.keys(d).length) {
        tx.update(templates).set({ ...d, updated_at: ctx.clock.now() }).where(eq(templates.id, id)).run();
        emit(tx, ctx, { type: "template.updated", summary: `Şablon düzenlendi: ${truncate(d.name ?? cur.name, 60)}`, data: { template_id: id } });
      }
      return { row: requireRow(ctx, "templates", id), effects: [] as string[] };
    });
  }

  /** Taslaklar kalır, sadece şablon bağı kopar */
  function remove(id: number) {
    const cur = requireRow(ctx, "templates", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("drafts", "template_id", id);
      bin.take("templates", "id = ?", id);
      bin.commit(tx, "template", id, cur.name);
      emit(tx, ctx, { type: "template.deleted", summary: `Şablon silindi: ${truncate(cur.name, 60)}` });
      return { effects: [] as string[], trash: { type: "template", id } };
    });
  }

  /** Şablonu kişiye ya da firmaya uygular (önizleme) */
  function render(id: number, subject: Subject) {
    const t = requireRow(ctx, "templates", id);
    if (!subjectInfo(ctx, subject)) throw new FFError("validation", "kişi ya da firma gerekli");
    return { body: renderTemplate(ctx, t.body, subject), template: t };
  }

  const suggest = (subject: Subject, channel?: string | null, kind?: string | null) => {
    if (!subject.person_id && !subject.company_id && !subject.contact) throw new FFError("validation", "kişi ya da firma gerekli");
    return suggestTemplates(ctx, subject, channel, kind);
  };

  return { create, update, remove, render, suggest };
}
