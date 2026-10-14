import { z } from "zod";
import { resolveRef, type McpDef, type McpFormat } from "@fullfollow/core";

type Row = Record<string, any>;

const idOrName = z.union([z.number(), z.string()]);
const QUOTA_NOTE: Record<string, string> = { near: " (yakın)", over: " (doldu)" };

/** One short line: sent/limit per limited channel, plus the email warmup notice while it is active */
function quotaText(q: any, f: McpFormat): string {
  if (!q) return "";
  const w = q.email_warmup;
  return [
    q.channels.length ? `Kota: ${q.channels.map((c: Row) => `${f.label(c.channel)} ${c.sent}/${c.limit}${c.sent > c.limit ? " (aştı)" : (QUOTA_NOTE[c.state] ?? "")}`).join(" · ")}` : "",
    w?.active ? `Soğuk e-posta kapalı (ısınma ${f.d(w.until)}'a kadar)` : "",
  ].filter(Boolean).join("\n");
}

/** How drafts and due follow-ups read in MCP output, the quota and draft lines of the Today view, the `draft` tool, and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["reject_note", "followup_step"],
  entities: {
    draft: {
      kind: "taslak",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.to_name ?? r.person_name}`, f.label(r.channel), f.label(r.status), !!r.followup_step && `${r.followup_step}. takip`, `"${f.cut(r.body, 60)}"`,
        r.reject_note && `ret: ${f.cut(r.reject_note, 40)}`,
      ),
    },
    /** a recipient whose follow-up is due (the lines of the "Takip zamanı" section) */
    followup: {
      kind: "takip",
      line: (r, f) => f.join(
        r.person_id ? `kişi #${r.person_id} ${r.name}` : r.company_id ? `firma #${r.company_id} ${r.name}` : r.name, r.person_id && r.company_name,
        `${r.step}/${r.steps}. takip`, `${r.days}g cevapsız`, f.label(r.channel),
      ),
    },
  },
  relations: { drafts: "draft" },
  // follow-up drafts in Claude's name for the ones whose time has come (a second call does not open a second draft for the same step); the Today text below lists them
  todayData: (mod) => ({ auto: mod("drafts")!.followups.generate().created.map((c) => `${c.name} ${c.step}. takip #${c.draft_id}`) }),
  today: [
    // the daily quota sits at the head of the text, after the week line
    { at: 1, head: true, render: (t, f) => quotaText(t.quota, f) },
    { at: 300, render: (t, f) => (t.auto?.length ? `Otomatik takip taslağı hazırlandı (${t.auto.length}): ${t.auto.join(", ")} · kişiye göre düzelt: save("draft",{body},id)` : "") },
    { at: 399, render: (t) => (t.draft_rules?.length ? `Taslak kuralları (Özgür'ün ret notlarından, bunlara uy):\n${t.draft_rules.map((r: string) => `- ${r}`).join("\n")}` : "") },
    { at: 400, render: (t, f) => f.section("Onay bekleyen taslak", "draft", t.drafts) },
    { at: 500, render: (t, f) => f.section("Takip zamanı (taslak yok)", "followup", t.followups ?? { rows: [], total: 0 }) },
  ],
  marketing: [{ at: 500, render: (m) => (m.followups.length ? [`Takip zamanı gelen: ${m.followups.length}`] : []) }],
  tools: [{
    name: "draft",
    description: "Özgür'ün onayına taslak mesaj bırak (why: neden şimdi, tek cümle). Muhatap person, company ya da contact. subject: e-posta konusu. body yoksa template (id/ad) muhataba uygulanır ({ad} {firma} {sektor}); uygun şablon: find template {channel,sector}. Onaylama ve gönderme sadece Özgür'de.",
    input: {
      person: idOrName.optional(), company: idOrName.optional(), contact: z.string().optional(), channel: z.string(), body: z.string().optional(),
      template: idOrName.optional(), subject: z.string().optional(), why: z.string().optional(), opp: idOrName.optional(), project: idOrName.optional(),
    },
    run: (ctx, a, f) => {
      const r = ctx.mod("drafts")!.create({
        person_id: a.person !== undefined ? resolveRef(ctx, "person", a.person) : undefined,
        company_id: a.company !== undefined ? resolveRef(ctx, "company", a.company) : undefined,
        contact: a.contact,
        channel: a.channel, subject: a.subject, body: a.body, reason: a.why,
        template_id: a.template !== undefined ? resolveRef(ctx, "template", a.template) : undefined,
        opportunity_id: a.opp !== undefined ? resolveRef(ctx, "opportunity", a.opp) : undefined,
        project_id: a.project !== undefined ? resolveRef(ctx, "project", a.project) : undefined,
      });
      return f.ok("taslak", r.row.id, ["onay bekliyor"]);
    },
  }],
  docs: {
    today: [{ at: 120, text: "takip dizisi (zamanı gelen takip taslakları otomatik hazırlanır), taslaklar, " }],
    open: [{ at: 200, text: "|draft" }],
    find: [
      { at: 200, text: "|draft" },
      { at: 422, text: "{status:'bekliyor'}(draft) " },
    ],
    get: [
      { at: 202, text: "drafts|" },
      { at: 400.1, text: "drafts," },
    ],
  },
};
