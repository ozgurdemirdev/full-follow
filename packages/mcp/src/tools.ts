import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FFError, normalizeType as normalizeTypeName, type Core } from "@fullfollow/core";
import { z } from "zod";
import { block, KIND_NAME, list, ok, reportText, timelineText, todayText } from "./format";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function run(fn: () => string) {
  try {
    return text(fn());
  } catch (e: any) {
    const msg = e instanceof FFError ? e.message : String(e?.message ?? e);
    return { content: [{ type: "text" as const, text: `hata: ${msg}` }], isError: true };
  }
}

const idOrName = z.union([z.number(), z.string()]);
const obj = z.record(z.string(), z.any());

/**
 * 11 araç. Tanım metinleri her istekte bağlama girdiği için kısa tutulur.
 * Taslak onaylama ve "gönderildi" işaretleme MCP'de yoktur (sadece Özgür).
 */
export function registerTools(server: McpServer, core: Core) {
  server.registerTool("today", {
    description: "Bugünün işleri: cevapsız yorumlar, onay bekleyen taslaklar, takipler, görevler, 7 gün içindeki ödemeler.",
    inputSchema: { limit: z.number().optional() },
  }, ({ limit }) => run(() => todayText(core.today(limit ?? 10))));

  server.registerTool("find", {
    description: "Ara/listele. type: person|company|opportunity|project|task|draft|payment|source|comment|touch|setting. filter örn {stage:'teklif'} {tag:'ajans'} {overdue:true} {status:'bekliyor'} {unanswered:true}(comment) {project_id:3} {all:true}(task).",
    inputSchema: { type: z.string(), q: z.string().optional(), filter: obj.optional(), limit: z.number().optional(), offset: z.number().optional() },
  }, ({ type, q, filter, limit, offset }) => run(() => list(normalizeTypeName(type), core.find(type, { q, filter, limit, offset }), offset ?? 0)));

  server.registerTool("get", {
    description: "Tek kaydın tam hali. id sayı ya da isim. with: touches|tasks|opportunities|projects|payments|drafts|comments|referrals|people.",
    inputSchema: { type: z.string(), id: idOrName, with: z.array(z.string()).optional() },
  }, ({ type, id, with: w }) => run(() => block(core.get(type, id, w ?? []))));

  server.registerTool("save", {
    description: "Oluştur/güncelle (id varsa güncelle). data DB alan adlarıyla; person/company/source/opp/project isimle verilebilir; tarih ISO ya da bugün/yarın/+3g. Aşama için move. Kişi etiketi: tags/add_tags/remove_tags. comment: {target_type,target_id,body} ya da {reply_to,body}; id + {resolved:true} konuyu kapatır. setting: {bagkur_monthly:5000}.",
    inputSchema: { type: z.string(), data: obj, id: idOrName.optional() },
  }, ({ type, data, id }) => run(() => {
    const t = normalizeTypeName(type);
    const r = core.save(type, data, id);
    return t === "setting" ? ok("ayar", undefined, [], Object.keys(data).join(",")) : ok(KIND_NAME[t], r.row?.id ?? (typeof id === "number" ? id : undefined), r.effects);
  }));

  server.registerTool("move", {
    description: "Aşama değiştir. Fırsat: bulundu|temas|cevap|gorusme|teklif|kazanildi|kaybedildi (kaybedildi için reason şart). Proje: pesinat|tasarim_onayi|test_surumu|yayin|teslim|bakim|iptal.",
    inputSchema: { type: z.string(), id: idOrName, stage: z.string(), reason: z.string().optional() },
  }, ({ type, id, stage, reason }) => run(() => {
    const t = normalizeTypeName(type);
    const r = core.move(type, id, stage, reason);
    return ok(KIND_NAME[t], r.row?.id, r.effects, `→ ${stage}`);
  }));

  server.registerTool("touch", {
    description: "Temas kaydı; fırsat aşamasını otomatik ilerletir. channel: whatsapp|email|telefon|yuz_yuze|r10|instagram|linkedin|diger. direction: giden|gelen. at: ISO ya da bugün/dün.",
    inputSchema: {
      person: idOrName, channel: z.string(), direction: z.string(), summary: z.string(),
      opp: idOrName.optional(), project: idOrName.optional(), at: z.string().optional(),
      kind: z.string().optional(), outcome: z.string().optional(),
    },
  }, (a) => run(() => {
    const r = core.touches.create({
      person_id: core.resolveRef("person", a.person), channel: a.channel, direction: a.direction, summary: a.summary,
      opportunity_id: a.opp !== undefined ? core.resolveRef("opportunity", a.opp) : undefined,
      project_id: a.project !== undefined ? core.resolveRef("project", a.project) : undefined,
      happened_at: a.at, kind: a.kind, outcome: a.outcome,
    });
    return ok("temas", r.row.id, r.effects);
  }));

  server.registerTool("draft", {
    description: "Özgür'ün onayına taslak mesaj bırak. Onaylama ve gönderme sadece Özgür'de.",
    inputSchema: { person: idOrName, channel: z.string(), body: z.string(), opp: idOrName.optional(), project: idOrName.optional() },
  }, (a) => run(() => {
    const r = core.drafts.create({
      person_id: core.resolveRef("person", a.person), channel: a.channel, body: a.body,
      opportunity_id: a.opp !== undefined ? core.resolveRef("opportunity", a.opp) : undefined,
      project_id: a.project !== undefined ? core.resolveRef("project", a.project) : undefined,
    });
    return ok("taslak", r.row.id, ["onay bekliyor"]);
  }));

  server.registerTool("pay", {
    description: "Ödeme gir: tutar mevcut ödenene eklenir (kısmi olabilir). date varsayılan bugün.",
    inputSchema: { payment_id: z.number(), amount: z.number(), date: z.string().optional() },
  }, ({ payment_id, amount, date }) => run(() => {
    const r = core.payments.pay(payment_id, amount, date);
    const p = r.row;
    const fmt = (n: number) => `${n.toLocaleString("tr-TR")}`;
    return ok("ödeme", p.id, [`${fmt(p.paid_amount)}/${fmt(p.expected_amount)}${p.paid_amount >= p.expected_amount ? " ödendi" : " kısmi"}`, ...r.effects.filter((e) => e !== "tamamen ödendi")]);
  }));

  server.registerTool("timeline", {
    description: "Kişi/fırsat/proje olay geçmişi (son N, eskiden yeniye).",
    inputSchema: { type: z.string(), id: idOrName, limit: z.number().optional() },
  }, ({ type, id, limit }) => run(() => timelineText(core.timeline(type, id, limit ?? 20))));

  server.registerTool("report", {
    description: "Kaynak bazında dönüşüm + ayın tahsilatı vs fiyat tabanı. month: YYYY-MM (varsayılan bu ay).",
    inputSchema: { month: z.string().optional() },
  }, ({ month }) => run(() => reportText(core.reports.report(month))));

  server.registerTool("delete", {
    description: "Kayıt sil (kurallar geçerli, olay yazılır).",
    inputSchema: { type: z.string(), id: idOrName },
  }, ({ type, id }) => run(() => {
    core.remove(type, id);
    return "ok";
  }));
}

