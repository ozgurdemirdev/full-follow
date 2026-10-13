import { eq } from "drizzle-orm";
import { emit, FFError, money, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { offers, opportunities } from "../db/schema";
import { offerCreate, offerUpdate } from "../schemas";
import { link, requireRow } from "./shared";
import { Bin } from "./trash";

type Offer = typeof offers.$inferSelect;

/** items is stored as JSON text; callers get the parsed array */
const present = (o: Offer) => ({ ...o, items: JSON.parse(o.items) as { label: string; amount: number }[] });

/** Offer versions of an opportunity, newest first */
export function offersOf(ctx: Ctx, opportunityId: number) {
  return rows<Offer>(ctx, "SELECT * FROM offers WHERE opportunity_id = ? ORDER BY version DESC", opportunityId).map(present);
}

/** Amount of the accepted offer of an opportunity (null when none is accepted) */
export function acceptedAmount(ctx: Ctx, opportunityId: number): number | null {
  return row(ctx, "SELECT amount FROM offers WHERE opportunity_id = ? AND accepted_at IS NOT NULL", opportunityId)?.amount ?? null;
}

/** One accepted offer per opportunity: clear the others, mark this one, and make its amount the opportunity's estimate */
function accept(q: Q, ctx: Ctx, o: Offer) {
  const t = ctx.clock.now();
  q.update(offers).set({ accepted_at: null, updated_at: t }).where(eq(offers.opportunity_id, o.opportunity_id)).run();
  q.update(offers).set({ accepted_at: ctx.clock.today() }).where(eq(offers.id, o.id)).run();
  q.update(opportunities).set({ estimated_value: o.amount, updated_at: t }).where(eq(opportunities.id, o.opportunity_id)).run();
}

export function offersService(ctx: Ctx) {
  /** The offer's file must belong to the same opportunity */
  function checkFile(fileId: number | null | undefined, opportunityId: number) {
    if (!fileId) return;
    const f = requireRow(ctx, "files", fileId);
    if (f.target_type !== "opportunity" || f.target_id !== opportunityId) throw new FFError("validation", "teklif dosyası bu fırsata ait olmalı");
  }

  function create(input: unknown) {
    const d = parse(offerCreate, input);
    return ctx.db.transaction((tx) => {
      requireRow(ctx, "opportunities", d.opportunity_id);
      checkFile(d.file_id, d.opportunity_id);
      const version = (row(ctx, "SELECT COALESCE(MAX(version), 0) + 1 v FROM offers WHERE opportunity_id = ?", d.opportunity_id)?.v ?? 1) as number;
      const r = tx.insert(offers).values({
        ...d, items: JSON.stringify(d.items), offered_at: d.offered_at ?? ctx.clock.today(), file_id: d.file_id ?? null, version, ...stamp(ctx),
      }).returning().get();
      emit(tx, ctx, { type: "offer.created", ...link(ctx, { opportunity_id: d.opportunity_id }), summary: `Teklif v${version} eklendi: ${money(r.amount)}`, data: { offer_id: r.id } });
      return { row: present(r), effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const { accepted, items, ...f } = parse(offerUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<Offer>(ctx, "offers", id);
      checkFile(f.file_id, cur.opportunity_id);
      const at = link(ctx, { opportunity_id: cur.opportunity_id });
      const changed = { ...f, ...(items ? { items } : {}) };
      if (Object.keys(changed).length) {
        tx.update(offers).set({ ...f, ...(items ? { items: JSON.stringify(items) } : {}), updated_at: ctx.clock.now() }).where(eq(offers.id, id)).run();
        emit(tx, ctx, { type: "offer.updated", ...at, summary: `Teklif v${cur.version} güncellendi (${Object.keys(changed).join(", ")})`, data: { offer_id: id } });
      }
      const effects: string[] = [];
      if (accepted === true && !cur.accepted_at) {
        const now = requireRow<Offer>(ctx, "offers", id);
        accept(tx, ctx, now);
        emit(tx, ctx, { type: "offer.accepted", ...at, summary: `Teklif v${cur.version} kabul edildi: ${money(now.amount)}`, data: { offer_id: id } });
        effects.push("fırsat değeri teklif tutarına çekildi");
      } else if (accepted === false && cur.accepted_at) {
        tx.update(offers).set({ accepted_at: null }).where(eq(offers.id, id)).run();
        emit(tx, ctx, { type: "offer.unaccepted", ...at, summary: `Teklif v${cur.version} kabulü geri alındı`, data: { offer_id: id } });
      } else if (cur.accepted_at && f.amount !== undefined && f.amount !== cur.amount) {
        // the accepted amount is the opportunity's estimate
        tx.update(opportunities).set({ estimated_value: f.amount, updated_at: ctx.clock.now() }).where(eq(opportunities.id, cur.opportunity_id)).run();
        effects.push("fırsat değeri güncellendi");
      }
      return { row: present(requireRow<Offer>(ctx, "offers", id)), effects };
    });
  }

  /** Into the trash; a removed accepted offer is no longer accepted when it comes back */
  function remove(id: number) {
    const cur = requireRow<Offer>(ctx, "offers", id);
    return ctx.db.transaction((tx) => {
      tx.update(offers).set({ accepted_at: null }).where(eq(offers.id, id)).run();
      const bin = new Bin(ctx);
      bin.take("offers", "id = ?", id);
      bin.commit(tx, "offer", id, `Teklif v${cur.version}: ${money(cur.amount)}`);
      emit(tx, ctx, { type: "offer.deleted", ...link(ctx, { opportunity_id: cur.opportunity_id }), summary: `Teklif v${cur.version} silindi` });
      return { effects: [] as string[], trash: { type: "offer", id } };
    });
  }

  return { create, update, remove };
}
