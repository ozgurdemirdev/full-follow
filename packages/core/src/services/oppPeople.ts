import { eq } from "drizzle-orm";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { opportunities, opportunityPeople } from "../db/schema";
import { label, type OppRole } from "../constants";
import { teamAdd, teamUpdate } from "../schemas";
import { link, requireRow } from "./shared";
import { Bin } from "./trash";

type Opp = Pick<typeof opportunities.$inferSelect, "id" | "person_id" | "title">;

/** Extra people of an opportunity with their names (the main contact is opportunities.person_id and is not listed here) */
export function teamOf(ctx: Ctx, opportunityId: number) {
  return rows(ctx, `SELECT x.*, p.name AS person_name, c.name AS company_name FROM opportunity_people x
    JOIN people p ON p.id = x.person_id LEFT JOIN companies c ON c.id = p.company_id WHERE x.opportunity_id = ? ORDER BY x.id`, opportunityId);
}

const nameOf = (ctx: Ctx, personId: number): string => row(ctx, "SELECT name FROM people WHERE id = ?", personId)?.name ?? `#${personId}`;

/** Adds a member, or changes the role and note of an existing one. Runs inside the caller's transaction. */
export function upsertMember(q: Q, ctx: Ctx, opp: Opp, personId: number, role: OppRole, note: string | null): string {
  requireRow(ctx, "people", personId);
  if (personId === opp.person_id) throw new FFError("rule", `${nameOf(ctx, personId)} zaten ana muhatap, ekip listesine eklenmez`);
  const cur = row(ctx, "SELECT * FROM opportunity_people WHERE opportunity_id = ? AND person_id = ?", opp.id, personId);
  const name = nameOf(ctx, personId);
  const at = link(ctx, { opportunity_id: opp.id, person_id: personId });
  if (cur) {
    q.update(opportunityPeople).set({ role, note, updated_at: ctx.clock.now() }).where(eq(opportunityPeople.id, cur.id)).run();
    emit(q, ctx, { type: "opp.person_updated", ...at, summary: `Ekipte güncellendi: ${name} (${label(role)})`, data: { opportunity_person_id: cur.id } });
    return `${name} ekipte güncellendi`;
  }
  const r = q.insert(opportunityPeople).values({ opportunity_id: opp.id, person_id: personId, role, note, ...stamp(ctx) }).returning().get();
  emit(q, ctx, { type: "opp.person_added", ...at, summary: `Ekibe eklendi: ${name} (${label(role)})`, data: { opportunity_person_id: r.id } });
  return `${name} ekibe eklendi`;
}

/** Takes a member off the team (into the trash). Runs inside the caller's transaction. */
export function dropMember(q: Q, ctx: Ctx, opp: Opp, personId: number): string {
  const cur = row(ctx, "SELECT id FROM opportunity_people WHERE opportunity_id = ? AND person_id = ?", opp.id, personId);
  const name = nameOf(ctx, personId);
  if (!cur) throw new FFError("not_found", `${name} bu fırsatın ekibinde değil`);
  const bin = new Bin(ctx);
  bin.take("opportunity_people", "id = ?", cur.id);
  bin.commit(q, "opportunity_person", cur.id, `Ekip: ${name}`);
  emit(q, ctx, { type: "opp.person_removed", ...link(ctx, { opportunity_id: opp.id, person_id: personId }), summary: `Ekipten çıkarıldı: ${name}` });
  return `${name} ekipten çıkarıldı`;
}

/** Team REST surface: add (or change) a member, change role or note by membership id, remove */
export function oppPeopleService(ctx: Ctx) {
  function add(opportunityId: number, input: unknown) {
    const d = parse(teamAdd, input);
    return ctx.db.transaction((tx) => {
      const opp = requireRow<Opp>(ctx, "opportunities", opportunityId);
      const effect = upsertMember(tx, ctx, opp, d.person_id, d.role, d.note);
      return { row: row(ctx, "SELECT * FROM opportunity_people WHERE opportunity_id = ? AND person_id = ?", opportunityId, d.person_id), effects: [effect] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(teamUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "opportunity_people", id);
      const opp = requireRow<Opp>(ctx, "opportunities", cur.opportunity_id);
      upsertMember(tx, ctx, opp, cur.person_id, d.role ?? cur.role, d.note === undefined ? cur.note : d.note);
      return { row: requireRow(ctx, "opportunity_people", id), effects: [] as string[] };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "opportunity_people", id);
    return ctx.db.transaction((tx) => {
      dropMember(tx, ctx, requireRow<Opp>(ctx, "opportunities", cur.opportunity_id), cur.person_id);
      return { effects: [] as string[], trash: { type: "opportunity_person", id } };
    });
  }

  return { add, update, remove };
}
