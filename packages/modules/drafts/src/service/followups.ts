import {
  dayOf, daysBetween, keptRow, keptRows, label, LOCALE, marketingSettings, renderTemplate, subjectWhere,
  type Ctx, type FollowupDue, type FollowUpDate,
} from "@fullfollow/core";
import { m } from "../messages";
import { draftsServices } from "./index";

/** Follow-up dates of people and (through the pipeline module) open opportunities in the range; the calendar feed reads this */
export function followUpDates(ctx: Ctx, from: string, to: string): FollowUpDate[] {
  const people = keptRows<FollowUpDate>(ctx, `SELECT 'person' AS type, p.id, p.name, substr(p.next_follow_up_at, 1, 10) AS date,
      EXISTS (SELECT 1 FROM touches t WHERE t.person_id = p.id AND t.direction = 'giden' AND substr(t.happened_at, 1, 10) >= substr(p.next_follow_up_at, 1, 10)) AS done
    FROM people p WHERE substr(p.next_follow_up_at, 1, 10) BETWEEN ? AND ?`, from, to);
  const opps = ctx.mod("pipeline")?.followUpsDue(from, to) ?? [];
  return [...people, ...opps].map((r) => ({ ...r, done: !!r.done }));
}

/** Temasın muhatap anahtarı: kişi, firma (kişisiz) ya da adres */
const SUBJECT_KEY = "CASE WHEN person_id IS NOT NULL THEN 'p' || person_id WHEN company_id IS NOT NULL THEN 'c' || company_id ELSE 'x' || contact_key END";
/** Taslak bu muhataba mı yazılmış */
const SAME_DRAFT = `(r.person_id = d.person_id OR (d.person_id IS NULL AND r.person_id IS NULL AND r.company_id = d.company_id)
  OR (d.person_id IS NULL AND d.company_id IS NULL AND r.person_id IS NULL AND r.company_id IS NULL AND r.contact = d.contact))`;

/**
 * Takip dizisi: cevapsız giden mesajdan (ilk cevapsız mesaj) `followup_days[k-1]` gün sonra k. takip zamanı gelir.
 * k = cevapsız giden mesaj sayısı (ilk mesaj + gönderilen takipler). Gelen temas diziyi sıfırlar.
 * Muhatap kişi, firma ya da sadece adres olabilir; firmanın herhangi bir çalışanından gelen cevap firmanın ve çalışanlarının dizisini sıfırlar.
 * Bekleyen taslağı olan muhatap ve bu dizide aynı adım için zaten taslak açılmış (reddedilmiş olsa bile) muhatap listeye girmez.
 */
export function followupsDue(ctx: Ctx): FollowupDue[] {
  const { followup_days } = marketingSettings(ctx);
  if (!followup_days.length) return [];
  const today = ctx.clock.today();
  const list = keptRows(ctx, `
    WITH t AS (SELECT *, ${SUBJECT_KEY} AS sk FROM touches),
    li AS (
      SELECT sk, MAX(at) AS at FROM (
        SELECT sk, happened_at AS at FROM t WHERE direction = 'gelen'
        UNION ALL SELECT 'c' || p.company_id, t.happened_at FROM t JOIN people p ON p.id = t.person_id WHERE t.direction = 'gelen' AND p.company_id IS NOT NULL
      ) GROUP BY sk
    ),
    pend AS (
      SELECT t.sk, MIN(t.happened_at) AS first_out, MAX(t.happened_at) AS last_out, COUNT(*) AS attempts,
        MAX(t.person_id) AS person_id, MAX(t.company_id) AS company_id, MAX(t.contact) AS contact
      FROM t LEFT JOIN li ON li.sk = t.sk
        LEFT JOIN people tp ON tp.id = t.person_id LEFT JOIN li lc ON lc.sk = 'c' || tp.company_id
      WHERE t.direction = 'giden' AND t.expects_reply = 1 AND (li.at IS NULL OR t.happened_at > li.at) AND (lc.at IS NULL OR t.happened_at > lc.at)
      GROUP BY t.sk
    )
    SELECT d.*, COALESCE(p.name, co.name, d.contact) AS name, COALESCE(pc.name, co.name) AS company_name,
      (SELECT channel FROM t x WHERE x.sk = d.sk AND x.direction = 'giden' AND x.expects_reply = 1 AND x.happened_at = d.last_out ORDER BY x.id DESC LIMIT 1) AS channel,
      EXISTS (SELECT 1 FROM drafts r WHERE ${SAME_DRAFT} AND r.status IN ('bekliyor', 'onaylandi')) AS has_pending,
      (SELECT MAX(followup_step) FROM drafts r WHERE ${SAME_DRAFT} AND r.created_at >= d.first_out) AS done_step
    FROM pend d LEFT JOIN people p ON p.id = d.person_id LEFT JOIN companies pc ON pc.id = p.company_id
    LEFT JOIN companies co ON co.id = d.company_id AND d.person_id IS NULL`);
  const out: FollowupDue[] = [];
  for (const r of list) {
    const step = r.attempts as number;
    if (step > followup_days.length || r.has_pending || (r.done_step ?? 0) >= step) continue;
    const days = Math.max(0, daysBetween(dayOf(r.first_out), today));
    if (days < followup_days[step - 1]) continue;
    const person_id = r.person_id ?? null;
    const company_id = person_id ? null : r.company_id ?? null;
    out.push({
      person_id, company_id, contact: person_id || company_id ? null : r.contact, name: r.name, company_name: r.company_name,
      channel: r.channel, step, steps: followup_days.length, days, attempts: r.attempts, since: r.first_out,
    });
  }
  return out.sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, LOCALE));
}

/**
 * Zamanı gelen her takip için onaya taslak bırakır (şablon: muhatabın kanal ve sektörüne uyan "takip" şablonu, yoksa varsayılan metin).
 * Tekrar çağrılırsa aynı adım için ikinci taslak açılmaz. Onay ve gönderme yine Özgür'de.
 * The template comes from the templates module when it is installed.
 */
export function generateFollowups(ctx: Ctx) {
  const { drafts } = draftsServices(ctx);
  const created: { draft_id: number; person_id: number | null; company_id: number | null; name: string; step: number }[] = [];
  for (const f of followupsDue(ctx)) {
    const subject = { person_id: f.person_id, company_id: f.company_id, contact: f.contact };
    // aynı çağrı içinde başka bir yol taslak açtıysa atla
    const [where, params] = subjectWhere(subject);
    if (keptRow(ctx, `SELECT 1 x FROM drafts WHERE ${where} AND status IN ('bekliyor', 'onaylandi')`, ...params)) continue;
    const t = ctx.mod("templates")?.suggest(subject, f.channel, "takip")[0];
    const body = renderTemplate(ctx, t?.body ?? m.followupBody(f.step), subject);
    const r = drafts.create({
      ...subject, channel: f.channel, body, template_id: t?.id ?? null, followup_step: f.step,
      reason: m.followupReason(f.step, f.steps, f.days, label(f.channel)),
    });
    created.push({ draft_id: r.row.id, person_id: f.person_id, company_id: f.company_id, name: f.name, step: f.step });
  }
  return { created, effects: created.map((c) => m.effect.followupDraft(c.name, c.step)) };
}
