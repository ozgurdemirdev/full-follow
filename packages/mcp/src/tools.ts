import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FFError, normalizeType as normalizeTypeName, type Core } from "@fullfollow/core";
import { z } from "zod";
import { block, bulkText, KIND_NAME, list, ok, reportText, timelineText, todayText } from "./format";

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
/** Muhatap: kişi, firma ya da sadece adres (biri) */
const subject = (core: Core, a: { person?: string | number; company?: string | number; contact?: string }) => ({
  person_id: a.person !== undefined ? core.resolveRef("person", a.person) : undefined,
  company_id: a.company !== undefined ? core.resolveRef("company", a.company) : undefined,
  contact: a.contact,
});

/**
 * 11 araç. Tanım metinleri her istekte bağlama girdiği için kısa tutulur.
 * Taslak onaylama ve "gönderildi" işaretleme MCP'de yoktur (sadece Özgür).
 */
export function registerTools(server: McpServer, core: Core) {
  server.registerTool("today", {
    description: "Bugünün işleri: cevapsız yorumlar, cevap bekleyenler, takip dizisi (zamanı gelen takip taslakları otomatik hazırlanır), taslaklar, güncellenecek paylaşımlar, soğuyanlar, görevler, ödemeler, haftalık sayılar.",
    inputSchema: { limit: z.number().optional() },
  }, ({ limit }) => run(() => {
    // takip dizisi: zamanı gelenlere Claude adına taslak (tekrar çağrılırsa aynı adım için ikinci taslak açılmaz)
    const auto = core.followups.generate().created.map((c) => `${c.name} ${c.step}. takip #${c.draft_id}`);
    return todayText({ ...core.today(limit ?? 10), auto });
  }));

  server.registerTool("find", {
    description: "Ara/listele. type: person|company|opportunity|project|task|draft|payment|source|comment|touch|sector|note|setting|post|template|idea|interest|tag|trash. person/company filter: {tag:'sıcak'} {sector:'Sağlık'} {source:'LinkedIn'} {status:'yazilmadi|yazildi|cevap_geldi|gorusuldu|olumsuz'} (virgülle çoklu); person {awaiting:true} {cooling:true} {channel:'linkedin'} {company_id:2} {post_id:2}; {stage:'teklif'} {overdue:true} {status:'bekliyor'}(draft) {unanswered:true}(comment) {person_id|company_id:3}(touch,note) {loose:true}(touch: kişisiz adres) {all:true}(task; tag/sector/source: silinenler dahil); post {refresh_due:true} {platform:'r10'}; template {channel,sector,kind:'takip'}; idea {stage,sector}; interest {idea_id|person_id}; trash {type:'person'}.",
    inputSchema: { type: z.string(), q: z.string().optional(), filter: obj.optional(), limit: z.number().optional(), offset: z.number().optional() },
  }, ({ type, q, filter, limit, offset }) => run(() => list(normalizeTypeName(type), core.find(type, { q, filter, limit, offset }), offset ?? 0)));

  server.registerTool("get", {
    description: "Tek kaydın tam hali. id sayı ya da isim. with: touches|tasks|opportunities|projects|payments|drafts|comments|referrals|people|notes|channels|posts (company: people,touches,opportunities,drafts,comments,channels; idea: people,touches,posts; post: people).",
    inputSchema: { type: z.string(), id: idOrName, with: z.array(z.string()).optional() },
  }, ({ type, id, with: w }) => run(() => block(core.get(type, id, w ?? []))));

  server.registerTool("save", {
    description: "Oluştur/güncelle (id varsa güncelle). data dizi ise toplu ekler (liste verildiğinde tek çağrı): mükerrerler (e-posta, alan adı, firma adı, LinkedIn, Instagram) atlanır ve raporlanır. data DB alan adlarıyla; person/company/source/opp/project isimle verilebilir (person {company:'ABC'} yoksa firmayı açar); tarih ISO ya da bugün/yarın/+3g. Aşama için move. person/company: tags/add_tags/remove_tags ['Sıcak','R10'], sectors ['Sağlık > Diş hekimi'], source:'LinkedIn' (nereden buldum), contact_status:'olumsuz'. company: {name,website,email,phone,instagram,linkedin,notes}. tag: {name,color}. opportunity: source_url, source_date (ilan linki/tarihi). note: {person,body}. touch id + {expects_reply:false} cevap beklemeyi kapatır. comment: {target_type,target_id,body} ya da {reply_to,body}; id + {resolved:true} konuyu kapatır. setting: {bagkur_monthly:5000} {followup_days:'3,7'} {weekly_target:20}. post: {platform:r10|linkedin|instagram|diger,title,url,posted_at,refresh_days}; id + {refreshed:true} = güncellendi; kişinin kaynağı: person {post:'başlık'}. template: {name,kind:ilk|takip|teklif|diger,channel?,sector?,body} yer tutucu {ad} {firma} {sektor}. idea: {title,problem,stage,sectors:['Sağlık > Diş hekimi'],notes}. interest: {idea,person,interest:anlatildi|ilgilendi|ilgilenmedi,note}.",
    inputSchema: { type: z.string(), data: z.union([obj, z.array(obj)]), id: idOrName.optional() },
  }, ({ type, data, id }) => run(() => {
    const t = normalizeTypeName(type);
    if (Array.isArray(data)) return bulkText(KIND_NAME[t], core.saveMany(type, data));
    const r = core.save(type, data, id);
    return t === "setting" ? ok("ayar", undefined, [], Object.keys(data).join(",")) : ok(KIND_NAME[t], r.row?.id ?? (typeof id === "number" ? id : undefined), r.effects);
  }));

  server.registerTool("move", {
    description: "Aşama değiştir. Fırsat: bulundu|temas|cevap|gorusme|teklif|kazanildi|kaybedildi (kaybedildi için reason şart). Proje: pesinat|tasarim_onayi|test_surumu|yayin|teslim|bakim|iptal. Fikir: fikir|dogrulaniyor|demo|urun.",
    inputSchema: { type: z.string(), id: idOrName, stage: z.string(), reason: z.string().optional() },
  }, ({ type, id, stage, reason }) => run(() => {
    const t = normalizeTypeName(type);
    const r = core.move(type, id, stage, reason);
    return ok(KIND_NAME[t], r.row?.id, r.effects, `→ ${stage}`);
  }));

  server.registerTool("touch", {
    description: "Temas kaydı (fırsat gerekmez); muhatap person, company ya da sadece contact (kayıtsız adres/hesap: info@firma.com, @hesap; o adresle kişi/firma açılınca ona bağlanır). Kişi/firma temas durumu ilerler, fırsat varsa aşama ilerler. channel: email|instagram|linkedin|telefon|yuz_yuze|whatsapp|r10|diger. direction: giden|gelen. kind: mesaj|arama|gorusme. Giden mesaj cevap bekler. at: ISO ya da bugün/dün. idea: fikir anlatıldıysa.",
    inputSchema: {
      person: idOrName.optional(), company: idOrName.optional(), contact: z.string().optional(), channel: z.string(), direction: z.string(), summary: z.string(),
      opp: idOrName.optional(), project: idOrName.optional(), at: z.string().optional(),
      kind: z.string().optional(), outcome: z.string().optional(), idea: idOrName.optional(),
    },
  }, (a) => run(() => {
    const r = core.touches.create({
      ...subject(core, a), channel: a.channel, direction: a.direction, summary: a.summary,
      opportunity_id: a.opp !== undefined ? core.resolveRef("opportunity", a.opp) : undefined,
      project_id: a.project !== undefined ? core.resolveRef("project", a.project) : undefined,
      happened_at: a.at, kind: a.kind, outcome: a.outcome,
      idea_id: a.idea !== undefined ? core.resolveRef("idea", a.idea) : undefined,
    });
    return ok("temas", r.row.id, r.effects);
  }));

  server.registerTool("draft", {
    description: "Özgür'ün onayına taslak mesaj bırak (why: neden şimdi, tek cümle). Muhatap person, company ya da contact. body yoksa template (id/ad) muhataba uygulanır ({ad} {firma} {sektor}); uygun şablon: find template {channel,sector}. Onaylama ve gönderme sadece Özgür'de.",
    inputSchema: { person: idOrName.optional(), company: idOrName.optional(), contact: z.string().optional(), channel: z.string(), body: z.string().optional(), template: idOrName.optional(), why: z.string().optional(), opp: idOrName.optional(), project: idOrName.optional() },
  }, (a) => run(() => {
    const r = core.drafts.create({
      ...subject(core, a), channel: a.channel, body: a.body, reason: a.why,
      template_id: a.template !== undefined ? core.resolveRef("template", a.template) : undefined,
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
    description: "Haftalık temas sayıları, referans değeri, pazarlama (paylaşım getirisi, fikir ilgisi, şablon dönüşü, kanal dönüşü), kaynak dönüşümü, ayın tahsilatı vs fiyat tabanı. month: YYYY-MM.",
    inputSchema: { month: z.string().optional() },
  }, ({ month }) => run(() => reportText({ ...core.reports.report(month), week: core.reports.week(), referrals: core.reports.referrals(), marketing: core.marketing() })));

  server.registerTool("delete", {
    description: "Kayıt sil: çöp kutusuna gider (kurallar geçerli, olay yazılır); etiket/sektör/kaynak kayıtlarda kalır, yeni kayda seçilemez. restore:true silineni geri yükler (id ya da çöp kutusundaki ad; liste: find trash).",
    inputSchema: { type: z.string(), id: idOrName, restore: z.boolean().optional() },
  }, ({ type, id, restore }) => run(() => {
    if (restore) return ok("geri yüklendi", undefined, core.restore(type, id).effects);
    core.remove(type, id);
    return "ok · çöp kutusunda (geri: restore:true)";
  }));
}

