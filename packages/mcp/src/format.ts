/** Kısa düz metin çıktılar: boş alan yazılmaz, tek satır = tek kayıt */
import { label, type McpDef, type McpEntityDoc, type McpFormat } from "@fullfollow/core";

const thisYear = () => new Date().getFullYear();

export function d(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, day] = iso.slice(0, 10).split("-");
  return Number(y) === thisYear() ? `${day}.${m}` : `${day}.${m}.${y.slice(2)}`;
}
export const tl = (n?: number | null) => (n === null || n === undefined ? "" : `${n.toLocaleString("tr-TR")}₺`);
export function cut(s: string | null | undefined, n = 60): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
export const who = (a?: string) => (a === "claude" ? "Claude" : a === "ozgur" ? "Özgür" : a ?? "");
export const join = (...p: (string | number | null | undefined | false)[]) => p.filter((x) => x !== null && x !== undefined && x !== "" && x !== false).join(" · ");

type Row = Record<string, any>;

const LINE: Record<string, (r: Row) => string> = {
  sector: (r) => join(`#${r.id} ${r.path}`, `${r.people_count ?? 0} kişi`, !!r.company_count && `${r.company_count} firma`, r.deleted_at && "SİLİNDİ"),
  file: (r) => join(`#${r.id} ${r.name}`, `${Math.max(1, Math.round(r.size / 1024))} KB`, d(r.created_at)),
  link: (r) => join(`#${r.id} ${r.label}`, r.url, r.from && `(${r.from})`),
  note: (r) => join(`#${r.id} ${d(r.created_at)} ${who(r.created_by)}`, r.person_name, cut(r.body, 80)),
  tag: (r) => join(`#${r.id} ${r.name}`, `${r.people_count} kişi`, !!r.company_count && `${r.company_count} firma`, r.deleted_at && "SİLİNDİ"),
  trash: (r) => join(`${r.type} #${r.id} ${r.label}`, `${r.what} · silindi ${d(r.deleted_at)}`),
  source: (r) => join(`#${r.id} ${r.name}`, r.kind, `${r.opp_count ?? 0} fırsat`, !!r.people_count && `${r.people_count} kişi`, !!r.company_count && `${r.company_count} firma`, r.deleted_at && "SİLİNDİ"),
  draft: (r) => join(`#${r.id} ${r.to_name ?? r.person_name}`, label(r.channel), label(r.status), !!r.followup_step && `${r.followup_step}. takip`, `"${cut(r.body, 60)}"`, r.reject_note && `ret: ${cut(r.reject_note, 40)}`),
  comment: (r) => join(`#${r.id} [${r.target_label}]`, `${r.count > 1 ? `${who(r.root_by)}: "${cut(r.root_body, 60)}" → ` : ""}${who(r.last_by)} ${d(r.last_at)}: "${cut(r.last_body, 60)}"`, r.count > 1 && `${r.count} yorum`, r.last_by === "ozgur" && !r.resolved_at && "CEVAPSIZ", r.resolved_at && "kapalı"),
  setting: (r) => `${r.key}=${r.value}`,
  template: (r) => join(`#${r.id} ${r.name}`, label(r.kind), r.channel ? label(r.channel) : "tüm kanallar", r.sector_path ?? "tüm sektörler",
    !!r.used && `${r.used} kullanım`, !!r.sent && `${r.replied}/${r.sent} dönüş`, `"${cut(r.body, 50)}"`),
  idea: (r) => r.own_project_id
    ? join(`#${r.id} ${r.title}`, `proje: ${r.own_project_title}`, label(r.priority), r.done_at && "yapıldı", r.problem && `açıklama: ${cut(r.problem, 50)}`)
    : join(`#${r.id} ${r.title}`, label(r.stage), r.sectors?.map((x: Row) => x.path).join(", "),
    `${r.told} kişiye anlatıldı, ${r.interested} ilgilendi${r.interest_rate !== null ? ` (%${Math.round(r.interest_rate * 100)})` : ""}`,
    !!r.post_count && `${r.post_count} paylaşım`, r.problem && `sorun: ${cut(r.problem, 50)}`),
  own_project: (r) => join(`#${r.id} ${r.name}`, label(r.status), `satılabilir: ${label(r.sellable)}`, `${r.open_ideas} açık fikir`, r.sectors?.map((x: Row) => x.path).join(", ")),
  interest: (r) => join(`#${r.id} ${r.person_name}`, r.idea_title, label(r.interest), r.note && cut(r.note, 50)),
};

LINE.followup = (r) => join(r.person_id ? `kişi #${r.person_id} ${r.name}` : r.company_id ? `firma #${r.company_id} ${r.name}` : r.name, r.person_id && r.company_name, `${r.step}/${r.steps}. takip`, `${r.days}g cevapsız`, label(r.channel));

/** MCP output of the installed modules (set once by registerTools): record docs, relation names, today sections */
let entityDocs: Record<string, McpEntityDoc> = {};
let relationTypes: Record<string, string> = {};
let todaySections: { at: number; render(t: any, f: McpFormat): string }[] = [];
let marketingParts: { at: number; render(m: any, f: McpFormat): string[] }[] = [];

export function useMcpDefs(defs: McpDef[]) {
  entityDocs = Object.assign({}, ...defs.map((d) => d.entities ?? {}));
  relationTypes = Object.assign({}, ...defs.map((d) => d.relations ?? {}));
  todaySections = defs.flatMap((d) => d.today ?? []);
  marketingParts = defs.flatMap((d) => d.marketing ?? []);
}

export function line(type: string, r: Row): string {
  // a type whose module is not installed (a list of records that still exist): the name or title is all there is
  return (LINE[type] ?? ((x: Row) => entityDocs[type]?.line(x, mcpFormat) ?? join(`#${x.id}`, x.name ?? x.title)))(r);
}

/** Short Turkish name of a record type in confirmations ("görev") */
export const kindName = (type: string): string => KIND_NAME[type] ?? entityDocs[type]?.kind ?? type;

/** What a module's formatters get to format like the core types do */
export const mcpFormat: McpFormat = { d, tl, cut, who, join, label, line, section: (title, type, res) => sec(title, type, res), ok };

export function list(type: string, res: { rows: Row[]; total: number }, offset = 0): string {
  if (!res.rows.length) return "kayıt yok";
  const head = res.total > res.rows.length + offset ? `${offset + 1}-${offset + res.rows.length}/${res.total} (offset ile devam)\n` : "";
  return head + res.rows.map((r) => line(type, r)).join("\n");
}

const SKIP = new Set(["updated_at", "position", "tag_list", "created_at", "person_name", "source_name", "company_name", "referred_by_name", "project_name", "opportunity_title", "tags", "target_label", "comments", "last_id", "last_body", "last_by", "last_at", "count", "paid_total", "expected_total", "people_count", "opp_count", "next_payment", "next_task", "id", "status_label", "title", "name", "stage", "estimated_value", "price", "status", "channel", "handle", "email", "phone", "next_follow_up_at", "due_date", "due_time", "milestone", "expected_amount", "paid_amount", "kind", "assignee", "done_at", "lost_reason", "website", "body", "notes", "reject_note", "direction", "summary", "happened_at", "outcome", "project_id_x",
  "post_title", "post_id", "idea_title", "idea_id", "template_id", "followup_step", "platform", "url", "posted_at", "refresh_days", "refreshed_at", "next_refresh_at", "refresh_due",
  "opp_count", "won", "won_value", "used", "sent", "replied", "reply_rate", "problem", "told", "interested", "not_interested", "interest_rate", "touch_count", "post_count", "post_people", "sectors", "interest", "note", "person_id", "idea_stage", "score",
  "tag_ids", "source_id", "source_name", "contact_status", "deleted_at", "slug", "color", "company_count", "open_opps", "touch_count", "to_name", "contact",
  "company_id", "source_url", "source_date", "version", "offered_at", "amount", "accepted_at", "file_id", "opportunity_id",
  "description", "sellable", "sellable_note", "open_ideas", "done_ideas", "own_project_title", "own_project_id", "priority",
  "sector_name", "sector_path", "sector_id", "last_touch_at", "last_channel", "last_direction", "last_summary", "days_since", "awaiting", "cooling", "referral_count", "referral_value", "rhythm", "expects_reply", "path", "parent_name", "parent_id", "instagram", "linkedin"]);

/** Tek kaydın tam hali + istenen ilişkili kayıtlar */
export function block(res: { type: string; id: number; row: Row; related: Record<string, any[]>; comments_open?: number }): string {
  const { type, id, row, related } = res;
  const out: string[] = [];
  if (type === "comment") {
    out.push(join(`#${id} yorum konusu`, row.target_label, row.resolved_at && "kapalı"));
    for (const c of row.comments) out.push(`#${c.id} ${who(c.created_by)} ${d(c.created_at)}: ${c.body}`);
    return out.join("\n");
  }
  out.push(LINE[type] || entityDocs[type] ? line(type, row) : `#${id} ${type}`);
  // satırda olmayan alanları ek satır olarak yaz
  const extra = Object.entries(row)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== "" && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k}: ${typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? d(v) : v}`);
  if (extra.length) out.push(extra.join(" · "));
  if (row.instagram || row.linkedin) out.push(join(row.instagram && `instagram: ${row.instagram}`, row.linkedin && `linkedin: ${row.linkedin}`));
  if (row.referral_value) {
    const v = row.referral_value;
    out.push(`referans değeri: ${v.direct} tanıttı (ağ ${v.network}) · ${v.opps} fırsat · ${v.won} kazanıldı ${tl(v.won_value)}${v.open_value ? ` · açık ${tl(v.open_value)}` : ""}${v.collected ? ` · tahsil ${tl(v.collected)}` : ""}`);
  }
  if (row.post_title) out.push(`kaynak paylaşım: #${row.post_id} ${row.post_title}`);
  if (type === "own_project") {
    if (row.description) out.push(`ne yapıyor: ${row.description}`);
    if (row.sellable_note) out.push(`satış: ${row.sellable_note}`);
  }
  if (type === "idea" && row.problem) out.push(`sorun: ${row.problem}`);
  out.push(...(entityDocs[type]?.details?.(row, mcpFormat) ?? []));
  if (type === "interest" && row.note) out.push(`not: ${row.note}`);
  if (row.notes) out.push(`not: ${row.notes}`);
  if (row.body) out.push(`metin: ${row.body}`);
  if (res.comments_open) out.push(`açık yorum konusu: ${res.comments_open}`);
  for (const [name, rows] of Object.entries(related)) {
    if (!rows.length) { out.push(`${name}: yok`); continue; }
    if (name === "channels") {
      out.push(`kanallar: ${rows.map((c: Row) => `${label(c.channel)} ${c.out_count}→/${c.in_count}← son ${d(c.last_at)}${c.awaiting ? " (cevap bekliyor)" : ""}`).join(" · ")}`);
      continue;
    }
    const t = name === "people" && type === "idea" ? "interest"
      : name === "people" && type === "opportunity" ? "opp_person"
      : ({ ...relationTypes, links: "link", notes: "note", drafts: "draft", comments: "comment", ideas: "idea", files: "file" } as Record<string, string>)[name];
    out.push(`${name} (${rows.length}):`, ...rows.map((r) => "  " + line(t, r)));
  }
  return out.join("\n");
}

export function timelineText(events: Row[]): string {
  if (!events.length) return "olay yok";
  return events.map((e) => `${d(e.created_at)} ${who(e.created_by)} · ${e.summary}`).join("\n");
}

const sec = (title: string, type: string, res: { rows: Row[]; total: number }) =>
  res.total ? `${title} (${res.total}):\n` + res.rows.map((r) => "  " + line(type, r)).join("\n") + (res.total > res.rows.length ? `\n  … +${res.total - res.rows.length}` : "") : "";

const QUOTA_NOTE: Record<string, string> = { near: " (yakın)", over: " (doldu)" };

/** One short line: sent/limit per limited channel, plus the email warmup notice while it is active */
function quotaText(q: any): string[] {
  if (!q) return [];
  const w = q.email_warmup;
  return [
    q.channels.length ? `Kota: ${q.channels.map((c: Row) => `${label(c.channel)} ${c.sent}/${c.limit}${c.sent > c.limit ? " (aştı)" : (QUOTA_NOTE[c.state] ?? "")}`).join(" · ")}` : "",
    w?.active ? `Soğuk e-posta kapalı (ısınma ${d(w.until)}'a kadar)` : "",
  ].filter(Boolean);
}

export function todayText(t: any): string {
  // core's sections are numbered 100, 200, ...; a module's section has its own number and lands between them
  const core: { at: number; text: string }[] = [
    { at: 100, text: sec("Cevapsız yorum", "comment", t.comments) },
    { at: 300, text: t.auto?.length ? `Otomatik takip taslağı hazırlandı (${t.auto.length}): ${t.auto.join(", ")} · kişiye göre düzelt: save("draft",{body},id)` : "" },
    { at: 400, text: sec("Onay bekleyen taslak", "draft", t.drafts) },
    { at: 500, text: sec("Takip zamanı (taslak yok)", "followup", t.followups ?? { rows: [], total: 0 }) },
  ];
  const parts = [...core, ...todaySections.map((s) => ({ at: s.at, text: s.render(t, mcpFormat) }))]
    .sort((a, b) => a.at - b.at)
    .map((p) => p.text)
    .filter(Boolean);
  const w = t.week;
  const target = t.network?.settings?.weekly_target;
  const week = w ? `Hafta: ${w.sent}${target ? `/${target} hedef` : ""} giden (geçen ${w.sent_prev}) · ${w.replies} dönüş · ${w.meetings} görüşme${w.by_channel?.length ? ` · ${w.by_channel.map((c: Row) => `${label(c.channel)} ${c.sent}/${c.replies}`).join(", ")}` : ""}` : "";
  return [`BUGÜN ${t.date}`, week, ...quotaText(t.quota), ...(parts.length ? parts : ["bugün için iş yok"])].filter(Boolean).join("\n");
}

/** One kind/channel group of the template comparison: `ilk mesaj/e-posta: "A" %18 (40) önde · "B" erken (12)` (at most 3 templates) */
const templateGroupText = (g: Row) =>
  `${label(g.kind)}/${g.channel ? label(g.channel) : "tüm kanallar"}: ${g.templates.slice(0, 3).map((t: Row) =>
    `"${cut(t.name, 25)}" ${t.early ? "erken" : `%${Math.round(t.reply_rate * 100)}`} (${t.sent})${t.leader ? " önde" : ""}`).join(" · ")}`;

/** Pazarlama özeti (report aracının ikinci bölümü) */
export function marketingText(m: any): string {
  // core's lines are numbered 100, 200, ...; a module's lines have their own number and land between them
  const core: { at: number; lines: string[] }[] = [
    { at: 200, lines: m.ideas.length ? [`Fikirler: ${m.ideas.slice(0, 5).map((i: Row) => `${cut(i.title, 30)} (${label(i.stage)}) ${i.interested}/${i.told} ilgi`).join(" · ")}`] : [] },
    { at: 300, lines: m.template_groups.length ? [`Şablon: ${m.template_groups.map(templateGroupText).join(" | ")}`] : [] },
    { at: 400, lines: m.channels.length ? [`Kanal (30 gün, kişi): ${m.channels.map((c: Row) => `${label(c.channel)} ${c.replied}/${c.people}`).join(" · ")}`] : [] },
    { at: 500, lines: m.followups.length ? [`Takip zamanı gelen: ${m.followups.length}`] : [] },
  ];
  return [...core, ...marketingParts.map((p) => ({ at: p.at, lines: p.render(m, mcpFormat) }))]
    .sort((a, b) => a.at - b.at)
    .flatMap((p) => p.lines)
    .join("\n");
}

/** One line: `Kaynak (90g): R10 40→22→6→2→1→0 zayıf · Ajans 12→9→3→1→0→0 erken` (found → written → replied → meeting → offer → won) */
function sourceFunnelText(f: any): string {
  if (!f?.sources.length) return "";
  const flag = (s: Row) => (s.weak ? " zayıf" : s.early ? " erken" : "");
  return `Kaynak (${f.period === "all" ? "tümü" : `${f.period}g`}): ${f.sources.map((s: Row) => `${s.source} ${s.steps.map((x: Row) => x.count).join("→")}${flag(s)}`).join(" · ")}`;
}

export function reportText(r: any): string {
  const src = r.sources.length
    ? r.sources.map((s: Row) => join(s.source, `${s.total} fırsat`, `${s.won} kazanıldı/${s.lost} kayıp/${s.open} açık`, s.conversion === null ? "dönüşüm –" : `dönüşüm %${Math.round(s.conversion * 100)}`, s.won_value ? `kazanılan ${tl(s.won_value)}` : "")).join("\n")
    : "kaynak yok";
  const m = r.month;
  const gap = `${m.gap >= 0 ? "+" : ""}${tl(m.gap)}`;
  const w = r.week?.this_week;
  const week = w ? `Bu hafta: ${w.sent} giden · ${w.replies} dönüş${w.reply_rate !== null ? ` (%${Math.round(w.reply_rate * 100)})` : ""} · ${w.meetings} görüşme · ${w.new_people} yeni kişi\n` : "";
  const refs = r.referrals?.length ? `Referans: ${r.referrals.slice(0, 5).map((x: Row) => `${x.name} ${x.network} kişi, ${x.won} kazanıldı ${tl(x.won_value)}`).join(" · ")}\n` : "";
  const mk = r.marketing ? marketingText(r.marketing) : "";
  const funnel = sourceFunnelText(r.source_funnel);
  return `${week}${refs}${mk ? `${mk}\n` : ""}${funnel ? `${funnel}\n` : ""}${src}\n${m.month}: tahsilat ${tl(m.collected)} · taban ${tl(m.floor)} · fark ${gap}${m.outstanding_due ? ` · vadesi bu ayda kalan ${tl(m.outstanding_due)}` : ""}`;
}

const pctText = (r: number | null | undefined) => (r === null || r === undefined ? "–" : `%${Math.round(r * 100)}`);

/** Weekly review (report with week): header, counts against last week, template and source highlights, limit overruns, suggestions */
export function reviewText(r: any): string {
  const w = r.this_week;
  const l = r.last_week;
  const target = r.target ? `/${r.target} hedef` : "";
  const tpl = r.templates.map((g: Row) => `${label(g.kind)}/${g.channel ? label(g.channel) : "tüm kanallar"}: ${[
    g.leader ? `"${cut(g.leader.name, 25)}" önde ${pctText(g.leader.reply_rate)}` : "",
    g.loser ? `"${cut(g.loser.name, 25)}" geride ${pctText(g.loser.reply_rate)}` : "",
    g.early ? `${g.early} erken` : "",
  ].filter(Boolean).join(", ")}`);
  const src = [r.sources.best && `en iyi ${r.sources.best.source} ${pctText(r.sources.best.reply_rate)}`, r.sources.weakest && `zayıf ${r.sources.weakest.source} ${pctText(r.sources.weakest.reply_rate)}`].filter(Boolean);
  const full = r.quota.filter((c: Row) => c.over_days).map((c: Row) => `${label(c.channel)} ${c.over_days} gün (limit ${c.limit})`);
  return [
    `HAFTALIK İNCELEME ${r.week} (${d(r.start)} → ${d(r.end)})`,
    `Giden ${w.sent}${target} (geçen ${l.sent}) · dönüş ${w.replies} ${pctText(w.reply_rate)} (geçen ${pctText(l.reply_rate)}) · görüşme ${w.meetings} · teklif ${w.offers} · yeni ${w.new_people} kişi, ${w.new_companies} firma (geçen ${l.new_people + l.new_companies})`,
    tpl.length ? `Şablon: ${tpl.join(" | ")}` : "",
    src.length ? `Kaynak (${r.sources.period === "all" ? "tümü" : `${r.sources.period}g`}): ${src.join(" · ")}` : "",
    full.length ? `Limit doldu: ${full.join(" · ")}` : "",
    "Gelecek hafta için öneriler:",
    ...r.suggestions.map((x: Row, i: number) => `  ${i + 1}. ${x.text}`),
  ].filter(Boolean).join("\n");
}

export const KIND_NAME: Record<string, string> = {
  source: "kaynak",
  draft: "taslak", comment: "yorum", setting: "ayar", sector: "sektör", note: "not", link: "link",
  template: "şablon", idea: "fikir", own_project: "kendi projesi", interest: "fikir ilgisi", tag: "etiket", trash: "çöp kutusu",
};

/** Toplu kayıt özeti: eklenen sayısı, mükerrer diye atlananlar (hangi kayıtla çakıştı), hatalılar */
export function bulkText(kind: string, r: { created: { id: number; label: string; effects: string[] }[]; skipped: { index: number; label: string; existing: { type: string; id: number; label: string; field: string; in_trash: boolean } }[]; failed: { index: number; label: string; error: string }[] }): string {
  const out = [`ok · ${r.created.length} ${kind} eklendi${r.created.length ? ` (#${r.created[0].id}…#${r.created[r.created.length - 1].id})` : ""}`];
  const eff = r.created.flatMap((c) => c.effects);
  if (eff.length) out.push(`etki: ${eff.join(" · ")}`);
  if (r.skipped.length) {
    out.push(`atlandı (mükerrer) ${r.skipped.length}:`, ...r.skipped.map((s) => `  [${s.index}] ${s.label} → ${kindName(s.existing.type)} #${s.existing.id} ${s.existing.label} (${s.existing.field}${s.existing.in_trash ? ", çöp kutusunda" : ""})`));
  }
  if (r.failed.length) out.push(`hata ${r.failed.length}:`, ...r.failed.map((f) => `  [${f.index}] ${f.label}: ${f.error}`));
  return out.join("\n");
}

export function ok(kind: string, id: number | undefined, effects: string[] = [], extra?: string): string {
  return ["ok", `${kind}${id ? ` #${id}` : ""}${extra ? ` ${extra}` : ""}`, ...effects].join(" · ");
}
