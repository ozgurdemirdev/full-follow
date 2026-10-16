/** Kısa düz metin çıktılar: boş alan yazılmaz, tek satır = tek kayıt */
import { label, LOCALE, type McpDef, type McpEntityDoc, type McpFormat } from "@fullfollow/core";
import { CUT_CHARS, NOTE_CUT_CHARS } from "./constants";
import { m } from "./messages";

const thisYear = () => new Date().getFullYear();

export function d(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, day] = iso.slice(0, 10).split("-");
  return Number(y) === thisYear() ? `${day}.${m}` : `${day}.${m}.${y.slice(2)}`;
}
export const tl = (n?: number | null) => (n === null || n === undefined ? "" : `${n.toLocaleString(LOCALE)}${m.currency}`);
export function cut(s: string | null | undefined, n = CUT_CHARS): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}
/** The owner's name as the database has it now (set by registerTools; read per line, so a name given while the host runs shows at once) */
let ownerSource: () => string | null = () => null;
export const useOwnerName = (read: () => string | null) => {
  ownerSource = read;
};
export const who = (a?: string) => (a === "claude" ? m.who.claude : a === "owner" ? ownerSource() ?? m.who.owner : a === "musteri" ? m.who.customer : a ?? "");
export const join = (...p: (string | number | null | undefined | false)[]) => p.filter((x) => x !== null && x !== undefined && x !== "" && x !== false).join(" · ");

type Row = Record<string, any>;

const LINE: Record<string, (r: Row) => string> = {
  sector: (r) => join(`#${r.id} ${r.path}`, m.line.people(r.people_count ?? 0), !!r.company_count && m.line.companies(r.company_count), r.deleted_at && m.line.deleted),
  file: (r) => join(`#${r.id} ${r.name}`, m.line.kilobytes(Math.max(1, Math.round(r.size / 1024))), d(r.created_at)),
  link: (r) => join(`#${r.id} ${r.label}`, r.url, r.from && `(${r.from})`),
  note: (r) => join(`#${r.id} ${d(r.created_at)} ${who(r.created_by)}`, r.person_name, cut(r.body, NOTE_CUT_CHARS)),
  tag: (r) => join(`#${r.id} ${r.name}`, m.line.people(r.people_count), !!r.company_count && m.line.companies(r.company_count), r.deleted_at && m.line.deleted),
  trash: (r) => join(`${r.type} #${r.id} ${r.label}`, m.line.trashWhat(r.what, d(r.deleted_at))),
  source: (r) => join(`#${r.id} ${r.name}`, r.kind, m.line.opportunities(r.opp_count ?? 0), !!r.people_count && m.line.people(r.people_count), !!r.company_count && m.line.companies(r.company_count), r.deleted_at && m.line.deleted),
  comment: (r) => join(`#${r.id} [${r.target_label}]`, `${r.count > 1 ? `${who(r.root_by)}: "${cut(r.root_body, CUT_CHARS)}" → ` : ""}${who(r.last_by)} ${d(r.last_at)}: "${cut(r.last_body, CUT_CHARS)}"`, r.count > 1 && m.line.commentCount(r.count), r.last_by === "owner" && !r.resolved_at && m.line.unanswered, r.resolved_at && m.line.closed),
  setting: (r) => `${r.key}=${r.value}`,
};

/** MCP output of the installed modules (set once by registerTools): record docs, relation names, today sections */
let entityDocs: Record<string, McpEntityDoc> = {};
let relationTypes: Record<string, string> = {};
let relationLines: Record<string, (rows: Row[], f: McpFormat) => string> = {};
let todaySections: { at: number; head?: boolean; render(t: any, f: McpFormat): string }[] = [];
let marketingParts: { at: number; render(m: any, f: McpFormat): string[] }[] = [];

export function useMcpDefs(defs: McpDef[]) {
  entityDocs = Object.assign({}, ...defs.map((d) => d.entities ?? {}));
  relationTypes = Object.assign({}, ...defs.map((d) => d.relations ?? {}));
  relationLines = Object.assign({}, ...defs.map((d) => d.relationLines ?? {}));
  todaySections = defs.flatMap((d) => d.today ?? []);
  marketingParts = defs.flatMap((d) => d.marketing ?? []);
  skip = new Set([...CORE_SKIP, ...defs.flatMap((d) => d.skip ?? [])]);
}

export function line(type: string, r: Row): string {
  // a type whose module is not installed (a list of records that still exist): the name or title is all there is
  return (LINE[type] ?? ((x: Row) => entityDocs[type]?.line(x, mcpFormat) ?? join(`#${x.id}`, x.name ?? x.title)))(r);
}

/** Short Turkish name of a record type in confirmations ("görev") */
export const kindName = (type: string): string => KIND_NAME[type] ?? entityDocs[type]?.kind ?? type;

/** What a module's formatters get to format like the core types do */
const socials = (r: Row) => (r.instagram || r.linkedin ? [join(r.instagram && m.line.instagram(r.instagram), r.linkedin && m.line.linkedin(r.linkedin))] : []);
export const mcpFormat: McpFormat = { d, tl, cut, who, join, label, line, socials, section: (title, type, res) => sec(title, type, res), marketingParts: () => marketingParts, ok };

export function list(type: string, res: { rows: Row[]; total: number }, offset = 0): string {
  if (!res.rows.length) return m.list.empty;
  const head = res.total > res.rows.length + offset ? m.list.more(offset + 1, offset + res.rows.length, res.total) : "";
  return head + res.rows.map((r) => line(type, r)).join("\n");
}

/** Row fields `get` does not repeat as extra lines (the line of the record, the module lists and shared ids and names carry them); the modules add theirs with `skip` */
const CORE_SKIP = ["updated_at", "position", "tag_list", "created_at", "person_name", "source_name", "company_name", "project_name", "opportunity_title", "tags", "target_label", "comments", "last_id", "last_body", "last_by", "last_at", "count", "people_count", "opp_count", "id", "status_label", "title", "name", "stage", "price", "status", "channel", "email", "phone", "next_follow_up_at", "due_date", "milestone", "kind", "done_at", "website", "body", "notes", "direction", "summary", "happened_at", "outcome", "post_id", "idea_title", "idea_id", "template_id", "url", "refresh_due", "won", "won_value", "sent", "replied", "reply_rate", "problem", "told", "touch_count", "sectors", "interest", "note", "person_id", "tag_ids", "source_id", "contact_status", "deleted_at", "slug", "color", "company_count", "to_name", "contact", "company_id", "version", "amount", "file_id", "opportunity_id", "description", "own_project_id", "sector_path", "sector_id", "last_touch_at", "last_channel", "last_direction", "last_summary", "days_since", "awaiting", "cooling", "rhythm", "expects_reply", "path", "parent_name", "parent_id"];
let skip = new Set<string>(CORE_SKIP);

/** Tek kaydın tam hali + istenen ilişkili kayıtlar */
export function block(res: { type: string; id: number; row: Row; related: Record<string, any[]>; comments_open?: number }): string {
  const { type, id, row, related } = res;
  const out: string[] = [];
  if (type === "comment") {
    out.push(join(m.block.commentThread(id), row.target_label, row.resolved_at && m.line.closed));
    for (const c of row.comments) out.push(`#${c.id} ${who(c.created_by)} ${d(c.created_at)}: ${c.body}`);
    return out.join("\n");
  }
  out.push(LINE[type] || entityDocs[type] ? line(type, row) : `#${id} ${type}`);
  // satırda olmayan alanları ek satır olarak yaz
  const extra = Object.entries(row)
    .filter(([k, v]) => !skip.has(k) && v !== null && v !== "" && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k}: ${typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? d(v) : v}`);
  if (extra.length) out.push(extra.join(" · "));
  out.push(...(entityDocs[type]?.details?.(row, mcpFormat) ?? []));
  if (row.notes) out.push(m.block.note(row.notes));
  if (row.body) out.push(m.block.body(row.body));
  if (res.comments_open) out.push(m.block.openThreads(res.comments_open));
  for (const [name, rows] of Object.entries(related)) {
    if (!rows.length) { out.push(m.block.noRows(name)); continue; }
    if (relationLines[name]) {
      out.push(relationLines[name](rows, mcpFormat));
      continue;
    }
    // a module names its record type per relation, or per relation and record type ("people:idea": the people of an idea are interest rows)
    const t = relationTypes[`${name}:${type}`] ?? ({ ...relationTypes, links: "link", notes: "note", comments: "comment", files: "file" } as Record<string, string>)[name];
    out.push(`${name} (${rows.length}):`, ...rows.map((r) => "  " + line(t, r)));
  }
  return out.join("\n");
}

const sec = (title: string, type: string, res: { rows: Row[]; total: number }) =>
  res.total ? `${title} (${res.total}):\n` + res.rows.map((r) => "  " + line(type, r)).join("\n") + (res.total > res.rows.length ? `\n  … +${res.total - res.rows.length}` : "") : "";

export function todayText(t: any): string {
  // core's sections are numbered 100, 200, ...; a module's section has its own number and lands between them
  const core: { at: number; text: string }[] = [
    { at: 100, text: sec(m.today.comments, "comment", t.comments) },
  ];
  const parts = [...core, ...todaySections.filter((s) => !s.head).map((s) => ({ at: s.at, text: s.render(t, mcpFormat) }))]
    .sort((a, b) => a.at - b.at)
    .map((p) => p.text)
    .filter(Boolean);
  // lines a module puts before the sections (the week numbers, the daily quota)
  const head = todaySections.filter((s) => s.head).sort((a, b) => a.at - b.at).map((s) => s.render(t, mcpFormat));
  return [m.today.head(t.date), ...head, ...(parts.length ? parts : [m.today.nothing])].filter(Boolean).join("\n");
}

export const KIND_NAME: Record<string, string> = m.kind;

/** Toplu kayıt özeti: eklenen sayısı, mükerrer diye atlananlar (hangi kayıtla çakıştı), hatalılar */
export function bulkText(kind: string, r: { created: { id: number; label: string; effects: string[] }[]; skipped: { index: number; label: string; existing: { type: string; id: number; label: string; field: string; in_trash: boolean } }[]; failed: { index: number; label: string; error: string }[] }): string {
  const out = [m.bulk.added(r.created.length, kind, r.created.length ? ` (#${r.created[0].id}…#${r.created[r.created.length - 1].id})` : "")];
  const eff = r.created.flatMap((c) => c.effects);
  if (eff.length) out.push(m.bulk.effects(eff.join(" · ")));
  if (r.skipped.length) {
    out.push(m.bulk.skipped(r.skipped.length), ...r.skipped.map((s) => m.bulk.skippedLine(s.index, s.label, kindName(s.existing.type), s.existing.id, s.existing.label, s.existing.field, s.existing.in_trash)));
  }
  if (r.failed.length) out.push(m.bulk.failed(r.failed.length), ...r.failed.map((f) => `  [${f.index}] ${f.label}: ${f.error}`));
  return out.join("\n");
}

export function ok(kind: string, id: number | undefined, effects: string[] = [], extra?: string): string {
  return [m.ok, `${kind}${id ? ` #${id}` : ""}${extra ? ` ${extra}` : ""}`, ...effects].join(" · ");
}
