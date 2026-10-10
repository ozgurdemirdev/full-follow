/** Kısa düz metin çıktılar: boş alan yazılmaz, tek satır = tek kayıt */
import { label, PLATFORM_LABEL } from "@fullfollow/core";

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
const who = (a?: string) => (a === "claude" ? "Claude" : a === "ozgur" ? "Özgür" : a ?? "");
const join = (...p: (string | number | null | undefined | false)[]) => p.filter((x) => x !== null && x !== undefined && x !== "" && x !== false).join(" · ");

type Row = Record<string, any>;

const LINE: Record<string, (r: Row) => string> = {
  person: (r) => join(
    `#${r.id} ${r.name}`, r.tags?.join(","), r.sector_path, r.company_name, r.contact_status && r.contact_status !== "yazilmadi" && label(r.contact_status),
    r.source_name && `kaynak ${r.source_name}`,
    r.awaiting ? `CEVAP BEKLİYOR ${r.awaiting.days}g ${label(r.awaiting.channel)}${r.awaiting.attempts > 1 ? ` ${r.awaiting.attempts} deneme` : ""}` : r.last_touch_at && `son ${label(r.last_channel)} ${r.days_since}g önce`,
    r.cooling && "SOĞUYOR", r.next_follow_up_at && `takip ${d(r.next_follow_up_at)}`, r.handle, r.email, r.phone,
  ),
  sector: (r) => join(`#${r.id} ${r.path}`, `${r.people_count ?? 0} kişi`, !!r.company_count && `${r.company_count} firma`, r.deleted_at && "SİLİNDİ"),
  link: (r) => join(`#${r.id} ${r.label}`, r.url, r.from && `(${r.from})`),
  note: (r) => join(`#${r.id} ${d(r.created_at)} ${who(r.created_by)}`, r.person_name, cut(r.body, 80)),
  company: (r) => join(`#${r.id} ${r.name}`, label(r.contact_status), r.tags?.join(","), r.sector_path, r.source_name && `kaynak ${r.source_name}`,
    r.people_count ? `${r.people_count} kişi` : "", !!r.open_opps && `${r.open_opps} açık fırsat`, r.last_touch_at && `son temas ${d(r.last_touch_at)}`, r.website, r.email),
  tag: (r) => join(`#${r.id} ${r.name}`, `${r.people_count} kişi`, !!r.company_count && `${r.company_count} firma`, r.deleted_at && "SİLİNDİ"),
  trash: (r) => join(`${r.type} #${r.id} ${r.label}`, `${r.what} · silindi ${d(r.deleted_at)}`),
  source: (r) => join(`#${r.id} ${r.name}`, r.kind, `${r.opp_count ?? 0} fırsat`, !!r.people_count && `${r.people_count} kişi`, !!r.company_count && `${r.company_count} firma`, r.deleted_at && "SİLİNDİ"),
  opportunity: (r) => join(`#${r.id} ${r.title}`, r.person_name, r.company_name, label(r.stage), tl(r.estimated_value), r.source_name, r.source_date && `ilan ${d(r.source_date)}`, r.source_url, r.next_follow_up_at && `takip ${d(r.next_follow_up_at)}`, r.lost_reason && `neden: ${cut(r.lost_reason, 40)}`, r.project_id && `proje #${r.project_id}`),
  project: (r) => join(
    `#${r.id} ${r.name}`, r.person_name, label(r.stage), `${tl(r.paid_total)}/${tl(r.price)}`,
    r.next_payment && `sıradaki: ${label(r.next_payment.milestone)} ${tl(r.next_payment.remaining)}${r.next_payment.due_date ? ` ${d(r.next_payment.due_date)}` : ""}`,
    r.next_task && `görev: ${cut(r.next_task.title, 40)}`,
  ),
  task: (r) => join(`#${r.id} [${who(r.assignee)}] ${r.title}`, r.due_date && `son ${d(r.due_date)}`, r.done_at && "bitti", r.person_name || r.opportunity_title || r.project_name),
  draft: (r) => join(`#${r.id} ${r.to_name ?? r.person_name}`, label(r.channel), label(r.status), !!r.followup_step && `${r.followup_step}. takip`, `"${cut(r.body, 60)}"`, r.reject_note && `ret: ${cut(r.reject_note, 40)}`),
  payment: (r) => join(`#${r.id} ${r.project_name}`, label(r.milestone), `${tl(r.paid_amount)}/${tl(r.expected_amount)}`, r.due_date && `vade ${d(r.due_date)}`, r.status !== "bekliyor" && label(r.status === "odendi" ? "ödendi" : r.status === "kismi" ? "kısmi" : "gecikmiş")),
  touch: (r) => join(`#${r.id} ${d(r.happened_at)} ${r.direction} ${label(r.channel)}`, r.to_name ?? r.person_name, !r.person_id && r.company_id && "firma", cut(r.summary, 60), r.outcome && `→ ${cut(r.outcome, 30)}`, r.expects_reply && "cevap bekler"),
  comment: (r) => join(`#${r.id} [${r.target_label}]`, `${r.count > 1 ? `${who(r.root_by)}: "${cut(r.root_body, 60)}" → ` : ""}${who(r.last_by)} ${d(r.last_at)}: "${cut(r.last_body, 60)}"`, r.count > 1 && `${r.count} yorum`, r.last_by === "ozgur" && !r.resolved_at && "CEVAPSIZ", r.resolved_at && "kapalı"),
  setting: (r) => `${r.key}=${r.value}`,
  post: (r) => join(
    `#${r.id} ${PLATFORM_LABEL[r.platform] ?? r.platform} ${cut(r.title, 50)}`, d(r.posted_at),
    r.refresh_due ? "GÜNCELLE" : r.next_refresh_at && `güncelle ${d(r.next_refresh_at)}`,
    !!r.people_count && `${r.people_count} kişi`, !!r.opp_count && `${r.opp_count} fırsat`, !!r.won && `${r.won} kazanıldı ${tl(r.won_value)}`,
    r.idea_title && `fikir: ${cut(r.idea_title, 30)}`, r.url,
  ),
  template: (r) => join(`#${r.id} ${r.name}`, label(r.kind), r.channel ? label(r.channel) : "tüm kanallar", r.sector_path ?? "tüm sektörler",
    !!r.used && `${r.used} kullanım`, !!r.sent && `${r.replied}/${r.sent} dönüş`, `"${cut(r.body, 50)}"`),
  idea: (r) => join(`#${r.id} ${r.title}`, label(r.stage), r.sectors?.map((x: Row) => x.path).join(", "),
    `${r.told} kişiye anlatıldı, ${r.interested} ilgilendi${r.interest_rate !== null ? ` (%${Math.round(r.interest_rate * 100)})` : ""}`,
    !!r.post_count && `${r.post_count} paylaşım`, r.problem && `sorun: ${cut(r.problem, 50)}`),
  interest: (r) => join(`#${r.id} ${r.person_name}`, r.idea_title, label(r.interest), r.note && cut(r.note, 50)),
};

LINE.followup = (r) => join(r.person_id ? `kişi #${r.person_id} ${r.name}` : r.company_id ? `firma #${r.company_id} ${r.name}` : r.name, r.person_id && r.company_name, `${r.step}/${r.steps}. takip`, `${r.days}g cevapsız`, label(r.channel));

export function line(type: string, r: Row): string {
  return LINE[type](r);
}

export function list(type: string, res: { rows: Row[]; total: number }, offset = 0): string {
  if (!res.rows.length) return "kayıt yok";
  const head = res.total > res.rows.length + offset ? `${offset + 1}-${offset + res.rows.length}/${res.total} (offset ile devam)\n` : "";
  return head + res.rows.map((r) => line(type, r)).join("\n");
}

const SKIP = new Set(["updated_at", "position", "tag_list", "created_at", "person_name", "source_name", "company_name", "referred_by_name", "project_name", "opportunity_title", "tags", "target_label", "comments", "last_id", "last_body", "last_by", "last_at", "count", "paid_total", "expected_total", "people_count", "opp_count", "next_payment", "next_task", "id", "status_label", "title", "name", "stage", "estimated_value", "price", "status", "channel", "handle", "email", "phone", "next_follow_up_at", "due_date", "milestone", "expected_amount", "paid_amount", "kind", "assignee", "done_at", "lost_reason", "website", "body", "notes", "reject_note", "direction", "summary", "happened_at", "outcome", "project_id_x",
  "post_title", "post_id", "idea_title", "idea_id", "template_id", "followup_step", "platform", "url", "posted_at", "refresh_days", "refreshed_at", "next_refresh_at", "refresh_due",
  "opp_count", "won", "won_value", "used", "sent", "replied", "reply_rate", "problem", "told", "interested", "not_interested", "interest_rate", "touch_count", "post_count", "post_people", "sectors", "interest", "note", "person_id", "idea_stage", "score",
  "tag_ids", "source_id", "source_name", "contact_status", "deleted_at", "slug", "color", "company_count", "open_opps", "touch_count", "to_name", "contact",
  "company_id", "source_url", "source_date",
  "sector_name", "sector_path", "sector_id", "last_touch_at", "last_channel", "last_direction", "days_since", "awaiting", "cooling", "referral_count", "referral_value", "expects_reply", "path", "parent_name", "parent_id", "instagram", "linkedin"]);

/** Tek kaydın tam hali + istenen ilişkili kayıtlar */
export function block(res: { type: string; id: number; row: Row; related: Record<string, any[]>; comments_open?: number }): string {
  const { type, id, row, related } = res;
  const out: string[] = [];
  if (type === "comment") {
    out.push(join(`#${id} yorum konusu`, row.target_label, row.resolved_at && "kapalı"));
    for (const c of row.comments) out.push(`#${c.id} ${who(c.created_by)} ${d(c.created_at)}: ${c.body}`);
    return out.join("\n");
  }
  out.push(LINE[type] ? line(type, row) : `#${id} ${type}`);
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
  if (type === "idea" && row.problem) out.push(`sorun: ${row.problem}`);
  if (type === "post" && row.refresh_days) out.push(`yenileme: ${row.refresh_days} günde bir${row.refreshed_at ? ` · son ${d(row.refreshed_at)}` : ""}`);
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
      : ({ links: "link", notes: "note", touches: "touch", tasks: "task", opportunities: "opportunity", projects: "project", payments: "payment", drafts: "draft", people: "person", referrals: "person", comments: "comment", posts: "post" } as Record<string, string>)[name];
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

export function todayText(t: any): string {
  const parts = [
    sec("Cevapsız yorum", "comment", t.comments),
    sec("Cevap bekleyen", "person", t.network.awaiting),
    t.auto?.length ? `Otomatik takip taslağı hazırlandı (${t.auto.length}): ${t.auto.join(", ")} · kişiye göre düzelt: save("draft",{body},id)` : "",
    sec("Onay bekleyen taslak", "draft", t.drafts),
    sec("Takip zamanı (taslak yok)", "followup", t.followups ?? { rows: [], total: 0 }),
    sec("Güncellenecek paylaşım", "post", t.posts_due ?? { rows: [], total: 0 }),
    sec("Takip: kişi", "person", t.follow_ups.people),
    sec("Takip: fırsat", "opportunity", t.follow_ups.opportunities),
    sec("Soğuyan bağlantı", "person", t.network.cooling),
    sec("Görev", "task", t.tasks),
    sec("Ödeme (7 gün)", "payment", t.payments),
  ].filter(Boolean);
  const w = t.week;
  const target = t.network?.settings?.weekly_target;
  const week = w ? `Hafta: ${w.sent}${target ? `/${target} hedef` : ""} giden (geçen ${w.sent_prev}) · ${w.replies} dönüş · ${w.meetings} görüşme${w.by_channel?.length ? ` · ${w.by_channel.map((c: Row) => `${label(c.channel)} ${c.sent}/${c.replies}`).join(", ")}` : ""}` : "";
  return [`BUGÜN ${t.date}`, week, ...(parts.length ? parts : ["bugün için iş yok"])].filter(Boolean).join("\n");
}

/** Pazarlama özeti (report aracının ikinci bölümü) */
export function marketingText(m: any): string {
  const out: string[] = [];
  const posts = m.posts.filter((p: Row) => p.people_count || p.opp_count).slice(0, 5);
  if (posts.length) out.push(`Paylaşım getirisi: ${posts.map((p: Row) => `${cut(p.title, 30)} ${p.people_count} kişi, ${p.opp_count} fırsat${p.won ? `, ${tl(p.won_value)}` : ""}`).join(" · ")}`);
  if (m.posts_due.length) out.push(`Güncellenecek paylaşım: ${m.posts_due.length}`);
  if (m.ideas.length) out.push(`Fikirler: ${m.ideas.slice(0, 5).map((i: Row) => `${cut(i.title, 30)} (${label(i.stage)}) ${i.interested}/${i.told} ilgi`).join(" · ")}`);
  const tpl = m.templates.filter((x: Row) => x.sent).slice(0, 3);
  if (tpl.length) out.push(`Şablon dönüşü: ${tpl.map((x: Row) => `${cut(x.name, 25)} ${x.replied}/${x.sent}`).join(" · ")}`);
  if (m.channels.length) out.push(`Kanal (30 gün, kişi): ${m.channels.map((c: Row) => `${label(c.channel)} ${c.replied}/${c.people}`).join(" · ")}`);
  if (m.followups.length) out.push(`Takip zamanı gelen: ${m.followups.length}`);
  return out.join("\n");
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
  return `${week}${refs}${mk ? `${mk}\n` : ""}${src}\n${m.month}: tahsilat ${tl(m.collected)} · taban ${tl(m.floor)} · fark ${gap}${m.outstanding_due ? ` · vadesi bu ayda kalan ${tl(m.outstanding_due)}` : ""}`;
}

export const KIND_NAME: Record<string, string> = {
  person: "kişi", company: "firma", source: "kaynak", opportunity: "fırsat", project: "proje", task: "görev",
  draft: "taslak", payment: "ödeme", touch: "temas", comment: "yorum", setting: "ayar", sector: "sektör", note: "not", link: "link",
  post: "paylaşım", template: "şablon", idea: "fikir", interest: "fikir ilgisi", tag: "etiket", trash: "çöp kutusu",
};

/** Toplu kayıt özeti: eklenen sayısı, mükerrer diye atlananlar (hangi kayıtla çakıştı), hatalılar */
export function bulkText(kind: string, r: { created: { id: number; label: string; effects: string[] }[]; skipped: { index: number; label: string; existing: { type: string; id: number; label: string; field: string; in_trash: boolean } }[]; failed: { index: number; label: string; error: string }[] }): string {
  const out = [`ok · ${r.created.length} ${kind} eklendi${r.created.length ? ` (#${r.created[0].id}…#${r.created[r.created.length - 1].id})` : ""}`];
  const eff = r.created.flatMap((c) => c.effects);
  if (eff.length) out.push(`etki: ${eff.join(" · ")}`);
  if (r.skipped.length) {
    out.push(`atlandı (mükerrer) ${r.skipped.length}:`, ...r.skipped.map((s) => `  [${s.index}] ${s.label} → ${KIND_NAME[s.existing.type] ?? s.existing.type} #${s.existing.id} ${s.existing.label} (${s.existing.field}${s.existing.in_trash ? ", çöp kutusunda" : ""})`));
  }
  if (r.failed.length) out.push(`hata ${r.failed.length}:`, ...r.failed.map((f) => `  [${f.index}] ${f.label}: ${f.error}`));
  return out.join("\n");
}

export function ok(kind: string, id: number | undefined, effects: string[] = [], extra?: string): string {
  return ["ok", `${kind}${id ? ` #${id}` : ""}${extra ? ` ${extra}` : ""}`, ...effects].join(" · ");
}
