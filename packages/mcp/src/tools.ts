import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FFError, type Core } from "@fullfollow/core";
import { z } from "zod";
import { describer } from "./describe";
import { block, bulkText, kindName, list, mcpFormat, ok, reportText, reviewText, timelineText, todayText, useMcpDefs } from "./format";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

function run(fn: () => string) {
  try {
    return text(fn());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `hata: ${msg}` }], isError: true };
  }
}

/** Record types that have a page in the panel (what `open` may show) */
const CORE_OPENABLE = ["opportunity", "project", "draft", "template", "idea", "own_project", "comment"];
const idOrName = z.union([z.number(), z.string()]);
const obj = z.record(z.string(), z.any());
/** Muhatap: kişi, firma ya da sadece adres (biri) */
const subject = (core: Core, a: { person?: string | number; company?: string | number; contact?: string }) => ({
  person_id: a.person !== undefined ? core.resolveRef("person", a.person) : undefined,
  company_id: a.company !== undefined ? core.resolveRef("company", a.company) : undefined,
  contact: a.contact,
});

/**
 * 12 araç (modüllerin kendi araçları ayrıca). Tanım metinleri her istekte bağlama girdiği için kısa tutulur.
 * Taslak onaylama ve "gönderildi" işaretleme MCP'de yoktur (sadece Özgür).
 */
export function registerTools(server: McpServer, core: Core) {
  // what the installed modules add: record formatting, description fragments, tools of their own
  const defs = core.modules.list().flatMap((m) => (m.mcp ? [m.mcp] : []));
  useMcpDefs(defs);
  const describe = describer(defs);
  const openable = new Set([...CORE_OPENABLE, ...defs.flatMap((d) => Object.entries(d.entities ?? {}).filter(([, e]) => e.openable).map(([type]) => type))]);

  server.registerTool("today", {
    description: describe("today", [
      [100, "Bugünün işleri: cevapsız yorumlar, "],
      [120, "takip dizisi (zamanı gelen takip taslakları otomatik hazırlanır), taslaklar, "],
      [300, "ödemeler"],
      [320, "."],
    ]),
    inputSchema: { limit: z.number().optional() },
  }, ({ limit }) => run(() => {
    // takip dizisi: zamanı gelenlere Claude adına taslak (tekrar çağrılırsa aynı adım için ikinci taslak açılmaz)
    const auto = core.followups.generate().created.map((c) => `${c.name} ${c.step}. takip #${c.draft_id}`);
    return todayText({ ...core.today(limit ?? 10), auto });
  }));

  server.registerTool("open", {
    description: describe("open", [
      [100, "Kaydı Özgür'ün panelinde açar. Sadece Özgür açıkça aç, göster, nerede, bulamadım dediğinde çağır; ekleme, güncelleme, arama, rapor gibi başka hiçbir işin parçası olarak çağırma. type: "],
      [130, "opportunity|project"],
      [200, "|draft|template|idea|own_project"],
      [300, "|comment; id sayı ya da isim."],
    ]),
    inputSchema: { type: z.string(), id: idOrName },
  }, ({ type, id }) => run(() => {
    const t = core.normalizeType(type);
    if (!openable.has(t)) throw new FFError("validation", `${t} kaydının panelde sayfası yok`);
    const r = core.get(t, id);
    const row = r.row as Record<string, any>;
    const label = String(row.name ?? row.title ?? row.target_label ?? row.to_name ?? `#${r.id}`).slice(0, 60);
    // "(tür #id)": the panel chat reads the canonical record from this suffix
    return `açıldı: ${label} (${r.type} #${r.id})`;
  }));

  server.registerTool("find", {
    description: describe("find", [
      [100, "Ara/listele. type: "],
      [130, "opportunity|project"],
      [200, "|draft|payment|source|comment"],
      [220, "|sector|note|setting"],
      [300, "|template|idea|own_project|interest|tag"],
      [400, "|offer|trash. offer: {opportunity_id:3} teklif sürümleri, yeniden eskiye. "],
      [420, "{stage:'teklif'} {overdue:true} {status:'bekliyor'}(draft) {unanswered:true}(comment) "],
      [440, "{all:true}("],
      [500, "tag/sector/source: silinenler dahil); "],
      [600, "template {channel,sector,kind:'takip'}; idea {stage,sector,own_project:'Full Follow',general:true}; own_project {status,sellable,sector}; interest {idea_id|person_id}; trash {type:'person'}."],
    ]),
    inputSchema: { type: z.string(), q: z.string().optional(), filter: obj.optional(), limit: z.number().optional(), offset: z.number().optional() },
  }, ({ type, q, filter, limit, offset }) => run(() => list(core.normalizeType(type), core.find(type, { q, filter, limit, offset }), offset ?? 0)));

  server.registerTool("get", {
    description: describe("get", [
      [100, "Tek kaydın tam hali. id sayı ya da isim. with: "],
      [200, "opportunities|projects|payments|drafts|comments"],
      [220, "|people|notes"],
      [300, "|links|offers|files (opportunity: "],
      [400, "comments,drafts,links,people (ekip, ana muhatap hariç),offers (teklif sürümleri),files; project: links; "],
      [420, "idea: people"],
      [500, "; "],
      [600, "own_project: ideas,links,comments)."],
    ]),
    inputSchema: { type: z.string(), id: idOrName, with: z.array(z.string()).optional() },
  }, ({ type, id, with: w }) => run(() => block(core.get(type, id, w ?? []))));

  server.registerTool("save", {
    description: describe("save", [
      [100, "Oluştur/güncelle (id varsa güncelle). data dizi ise toplu ekler (liste verildiğinde tek çağrı): mükerrerler (e-posta, alan adı, firma adı, LinkedIn, Instagram) atlanır ve raporlanır. data DB alan adlarıyla; "],
      [130, "source/opp/project isimle verilebilir"],
      [141, "; tarih ISO ya da bugün/yarın/+3g. Aşama için move. "],
      [144, "tag: {name,color}. opportunity: source_url, source_date (ilan linki/tarihi); ekip: {add_people:[{person:'Deniz',role:'karar_verici|teknik|ortak|diger',note?}],remove_people:['Ahmet']} (id ile birlikte; ekipteki kişinin rolünü de değiştirir; ana muhatap person_id'dir, ekipte yer almaz). note: {person,body}. offer: {opportunity:'Pizza Z'|id,amount,offered_at?,items:[{label,amount}]?,note?} yeni sürüm açar (v1, v2...), id ile güncellenir; {accepted:true|false} + id teklifi kabul eder ya da kabulü geri alır (fırsatta tek kabul edilmiş teklif olur, kabul fırsat değerini teklif tutarına çeker; kazanınca proje fiyatı kabul edilen tekliften). link: {target_type:opportunity|project|own_project,target_id,label,url} (roadmap, teklif sunumu, Figma, repo; projede fırsatın linkleri de görünür). "],
      [146, "comment: {target_type,target_id,body} ya da {reply_to,body}; id + {resolved:true} konuyu kapatır. setting: {bagkur_monthly:5000} {followup_days:'3,7'} {weekly_target:20} {channel_limits:{email:20,instagram:15,whatsapp:15}} (günlük giden mesaj limiti, 0 = limitsiz) {email_warmup_until:'2026-10-27'} (bu tarihe kadar soğuk e-posta kapalı, boş = yok). "],
      [200, "template: {name,kind:ilk|takip|teklif|diger,channel?,sector?,body} yer tutucu {ad} {firma} {sektor}. idea: {title,problem,stage,sectors:['Sağlık > Diş hekimi'],notes,parent:'üst fikir' (sadece genel), own_project:'Full Follow'|null (null = genel), priority:yuksek|orta|dusuk, position (0 = üst), done:true|false}. own_project: {name,description,status,sellable:evet|belki|hayir,sellable_note,sectors,notes}; {from_idea:'fikir adı'} fikri projeye çevirir (alt fikirler taşınır, fikir çöpe). interest: {idea,person,interest:anlatildi|ilgilendi|ilgilenmedi,note}. "],
    ]),
    inputSchema: { type: z.string(), data: z.union([obj, z.array(obj)]), id: idOrName.optional() },
  }, ({ type, data, id }) => run(() => {
    const t = core.normalizeType(type);
    if (Array.isArray(data)) return bulkText(kindName(t), core.saveMany(type, data));
    const r = core.save(type, data, id);
    return t === "setting" ? ok("ayar", undefined, [], Object.keys(data).join(",")) : ok(kindName(t), r.row?.id ?? (typeof id === "number" ? id : undefined), r.effects);
  }));

  server.registerTool("move", {
    description: "Aşama değiştir. Fırsat: bulundu|temas|cevap|gorusme|teklif|kazanildi|kaybedildi (kaybedildi için reason şart). Proje: pesinat|tasarim_onayi|test_surumu|yayin|teslim|bakim|iptal. Fikir: fikir|dogrulaniyor|demo|urun. Kendi projesi: aktif|beklemede|tamamlandi|birakildi.",
    inputSchema: { type: z.string(), id: idOrName, stage: z.string(), reason: z.string().optional() },
  }, ({ type, id, stage, reason }) => run(() => {
    const t = core.normalizeType(type);
    const r = core.move(type, id, stage, reason);
    return ok(kindName(t), r.row?.id, r.effects, `→ ${stage}`);
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
    description: describe("report", [
      [120, "pazarlama ("],
      [200, "fikir ilgisi, şablon dönüşü, kanal dönüşü), kaynak hunisi (bulundu→yazıldı→cevap→görüşme→teklif→kazanıldı, son 90 gün; zayıf/erken işaretli), kaynak dönüşümü, ayın tahsilatı vs fiyat tabanı. month: YYYY-MM. week: YYYY-Www, haftadan bir tarih ya da \"bu\" verilirse rapor yerine o haftanın incelemesi (Cuma özeti): giden/hedef, dönüş oranı, görüşme, teklif, yeni kayıt, şablon ve kaynak öne çıkanları, limit aşımı, gelecek hafta için 2-4 öneri."],
    ]),
    inputSchema: { month: z.string().optional(), week: z.string().optional() },
  }, ({ month, week }) => run(() => (week ? reviewText(core.review(week === "bu" ? undefined : week)) : reportText({ ...core.reports.report(month), week: core.mod("network")?.weekStats(), referrals: core.reports.referrals(), marketing: core.marketing(), source_funnel: core.reports.sourceFunnel() }))));

  server.registerTool("delete", {
    description: "Kayıt sil (offer dahil): çöp kutusuna gider (kurallar geçerli, olay yazılır); etiket/sektör/kaynak kayıtlarda kalır, yeni kayda seçilemez. restore:true silineni geri yükler (id ya da çöp kutusundaki ad; liste: find trash).",
    inputSchema: { type: z.string(), id: idOrName, restore: z.boolean().optional() },
  }, ({ type, id, restore }) => run(() => {
    if (restore) return ok("geri yüklendi", undefined, core.restore(type, id).effects);
    core.remove(type, id);
    return "ok · çöp kutusunda (geri: restore:true)";
  }));

  // tools only an installed module has (the calendar's plan, ...)
  for (const tool of defs.flatMap((d) => d.tools ?? [])) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input }, (args: any) => run(() => tool.run(core.ctx, args, mcpFormat)));
  }
}
