import { z } from "zod";
import { resolveRef, type McpDef } from "@fullfollow/core";

const idOrName = z.union([z.number(), z.string()]);
/** Muhatap: kişi, firma ya da sadece adres (biri) */
type Subject = { person?: string | number; company?: string | number; contact?: string };

/** How touches read in MCP output, the `touch` tool, and the network's lines of the Today view; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    touch: {
      kind: "temas",
      line: (r, f) => f.join(
        `#${r.id} ${f.d(r.happened_at)} ${r.direction} ${f.label(r.channel)}`, r.to_name ?? r.person_name, !r.person_id && r.company_id && "firma", f.cut(r.summary, 60),
        r.outcome && `→ ${f.cut(r.outcome, 30)}`, r.expects_reply && "cevap bekler",
        r.suggested_match && `öneri: ${r.suggested_match.type === "person" ? "kişi" : "firma"} #${r.suggested_match.id} ${r.suggested_match.name}`,
      ),
    },
  },
  relations: { touches: "touch" },
  today: [
    { at: 200, render: (t, f) => (t.network ? f.section("Cevap bekleyen", "person", t.network.awaiting) : "") },
    { at: 800, render: (t, f) => (t.network ? f.section("Soğuyan bağlantı", "person", t.network.cooling) : "") },
  ],
  docs: {
    today: [
      { at: 110, text: "cevap bekleyenler, " },
      { at: 200, text: "soğuyanlar, " },
      { at: 310, text: ", haftalık sayılar" },
    ],
    find: [
      { at: 210, text: "|touch" },
      { at: 430, text: "{person_id|company_id:3}(touch,note) {loose:true}(touch: kişisiz adres) " },
    ],
    get: [
      { at: 110, text: "touches|" },
      { at: 230, text: "|channels" },
      { at: 310, text: "touches," },
      { at: 430, text: ",touches" },
    ],
    save: [{ at: 145, text: "touch id + {expects_reply:false} cevap beklemeyi kapatır; id + {person_id|company_id} kişisiz adres temasını o kayda bağlar (find loose çıktısındaki öneri). " }],
    report: [{ at: 100, text: "Haftalık temas sayıları, " }],
  },
  tools: [{
    name: "touch",
    description: "Temas kaydı (fırsat gerekmez); muhatap person, company ya da sadece contact (kayıtsız adres/hesap: info@firma.com, @hesap; o adresle kişi/firma açılınca ona bağlanır). Kişi/firma temas durumu ilerler, fırsat varsa aşama ilerler. channel: email|instagram|linkedin|telefon|yuz_yuze|whatsapp|r10|diger. direction: giden|gelen. kind: mesaj|arama|gorusme. Giden mesaj cevap bekler. at: ISO ya da bugün/dün. idea: fikir anlatıldıysa.",
    input: {
      person: idOrName.optional(), company: idOrName.optional(), contact: z.string().optional(), channel: z.string(), direction: z.string(), summary: z.string(),
      opp: idOrName.optional(), project: idOrName.optional(), at: z.string().optional(),
      kind: z.string().optional(), outcome: z.string().optional(), idea: idOrName.optional(),
    },
    run: (ctx, a: Subject & Record<string, any>, f) => {
      const r = ctx.mod("network")!.touches.create({
        person_id: a.person !== undefined ? resolveRef(ctx, "person", a.person) : undefined,
        company_id: a.company !== undefined ? resolveRef(ctx, "company", a.company) : undefined,
        contact: a.contact,
        channel: a.channel, direction: a.direction, summary: a.summary,
        opportunity_id: a.opp !== undefined ? resolveRef(ctx, "opportunity", a.opp) : undefined,
        project_id: a.project !== undefined ? resolveRef(ctx, "project", a.project) : undefined,
        happened_at: a.at, kind: a.kind, outcome: a.outcome,
        idea_id: a.idea !== undefined ? resolveRef(ctx, "idea", a.idea) : undefined,
      });
      return f.ok("temas", r.row.id, r.effects);
    },
  }],
};
