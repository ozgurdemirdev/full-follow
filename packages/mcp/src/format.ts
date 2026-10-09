/** Kısa düz metin çıktılar: boş alan yazılmaz, tek satır = tek kayıt */
import { label } from "@fullfollow/core";

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
  person: (r) => join(`#${r.id} ${r.name}`, r.tags?.map(label).join(","), r.company_name, r.next_follow_up_at && `takip ${d(r.next_follow_up_at)}`, r.handle, r.email, r.phone),
  company: (r) => join(`#${r.id} ${r.name}`, r.people_count ? `${r.people_count} kişi` : "", r.website),
  source: (r) => join(`#${r.id} ${r.name}`, r.kind, `${r.opp_count ?? 0} fırsat`),
  opportunity: (r) => join(`#${r.id} ${r.title}`, r.person_name, label(r.stage), tl(r.estimated_value), r.source_name, r.next_follow_up_at && `takip ${d(r.next_follow_up_at)}`, r.lost_reason && `neden: ${cut(r.lost_reason, 40)}`, r.project_id && `proje #${r.project_id}`),
  project: (r) => join(
    `#${r.id} ${r.name}`, r.person_name, label(r.stage), `${tl(r.paid_total)}/${tl(r.price)}`,
    r.next_payment && `sıradaki: ${label(r.next_payment.milestone)} ${tl(r.next_payment.remaining)}${r.next_payment.due_date ? ` ${d(r.next_payment.due_date)}` : ""}`,
    r.next_task && `görev: ${cut(r.next_task.title, 40)}`,
  ),
  task: (r) => join(`#${r.id} [${who(r.assignee)}] ${r.title}`, r.due_date && `son ${d(r.due_date)}`, r.done_at && "bitti", r.person_name || r.opportunity_title || r.project_name),
  draft: (r) => join(`#${r.id} ${r.person_name}`, label(r.channel), label(r.status), `"${cut(r.body, 60)}"`, r.reject_note && `ret: ${cut(r.reject_note, 40)}`),
  payment: (r) => join(`#${r.id} ${r.project_name}`, label(r.milestone), `${tl(r.paid_amount)}/${tl(r.expected_amount)}`, r.due_date && `vade ${d(r.due_date)}`, r.status !== "bekliyor" && label(r.status === "odendi" ? "ödendi" : r.status === "kismi" ? "kısmi" : "gecikmiş")),
  touch: (r) => join(`#${r.id} ${d(r.happened_at)} ${r.direction} ${label(r.channel)}`, r.person_name, cut(r.summary, 60), r.outcome && `→ ${cut(r.outcome, 30)}`),
  comment: (r) => join(`#${r.id} [${r.target_label}]`, `${who(r.last_by)} ${d(r.last_at)}: "${cut(r.last_body, 60)}"`, r.count > 1 && `${r.count} yorum`, r.last_by === "ozgur" && !r.resolved_at && "CEVAPSIZ", r.resolved_at && "kapalı"),
  setting: (r) => `${r.key}=${r.value}`,
};

export function line(type: string, r: Row): string {
  return LINE[type](r);
}

export function list(type: string, res: { rows: Row[]; total: number }, offset = 0): string {
  if (!res.rows.length) return "kayıt yok";
  const head = res.total > res.rows.length + offset ? `${offset + 1}-${offset + res.rows.length}/${res.total} (offset ile devam)\n` : "";
  return head + res.rows.map((r) => line(type, r)).join("\n");
}

const SKIP = new Set(["updated_at", "position", "tag_list", "created_at", "person_name", "source_name", "company_name", "referred_by_name", "project_name", "opportunity_title", "tags", "target_label", "comments", "last_id", "last_body", "last_by", "last_at", "count", "paid_total", "expected_total", "people_count", "opp_count", "next_payment", "next_task", "id", "status_label", "title", "name", "stage", "estimated_value", "price", "status", "channel", "handle", "email", "phone", "next_follow_up_at", "due_date", "milestone", "expected_amount", "paid_amount", "kind", "assignee", "done_at", "lost_reason", "website", "body", "notes", "reject_note", "direction", "summary", "happened_at", "outcome", "project_id_x"]);

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
  if (row.notes) out.push(`not: ${row.notes}`);
  if (row.body) out.push(`metin: ${row.body}`);
  if (res.comments_open) out.push(`açık yorum konusu: ${res.comments_open}`);
  for (const [name, rows] of Object.entries(related)) {
    if (!rows.length) { out.push(`${name}: yok`); continue; }
    const t = ({ touches: "touch", tasks: "task", opportunities: "opportunity", projects: "project", payments: "payment", drafts: "draft", people: "person", referrals: "person", comments: "comment" } as Record<string, string>)[name];
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
    sec("Onay bekleyen taslak", "draft", t.drafts),
    sec("Takip: kişi", "person", t.follow_ups.people),
    sec("Takip: fırsat", "opportunity", t.follow_ups.opportunities),
    sec("Görev", "task", t.tasks),
    sec("Ödeme (7 gün)", "payment", t.payments),
  ].filter(Boolean);
  return [`BUGÜN ${t.date}`, ...(parts.length ? parts : ["bugün için iş yok"])].join("\n");
}

export function reportText(r: any): string {
  const src = r.sources.length
    ? r.sources.map((s: Row) => join(s.source, `${s.total} fırsat`, `${s.won} kazanıldı/${s.lost} kayıp/${s.open} açık`, s.conversion === null ? "dönüşüm –" : `dönüşüm %${Math.round(s.conversion * 100)}`, s.won_value ? `kazanılan ${tl(s.won_value)}` : "")).join("\n")
    : "kaynak yok";
  const m = r.month;
  const gap = `${m.gap >= 0 ? "+" : ""}${tl(m.gap)}`;
  return `${src}\n${m.month}: tahsilat ${tl(m.collected)} · taban ${tl(m.floor)} · fark ${gap}${m.outstanding_due ? ` · vadesi bu ayda kalan ${tl(m.outstanding_due)}` : ""}`;
}

export const KIND_NAME: Record<string, string> = {
  person: "kişi", company: "firma", source: "kaynak", opportunity: "fırsat", project: "proje", task: "görev",
  draft: "taslak", payment: "ödeme", touch: "temas", comment: "yorum", setting: "ayar",
};

export function ok(kind: string, id: number | undefined, effects: string[] = [], extra?: string): string {
  return ["ok", `${kind}${id ? ` #${id}` : ""}${extra ? ` ${extra}` : ""}`, ...effects].join(" · ");
}
