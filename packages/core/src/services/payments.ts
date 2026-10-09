import { and, eq } from "drizzle-orm";
import { emit, FFError, money, parse, row, rows, stamp, type Ctx } from "../context";
import { comments, payments } from "../db/schema";
import { label } from "../constants";
import { paymentCreate, paymentUpdate } from "../schemas";
import { z } from "zod";
import { link, requireRow } from "./shared";

export type PaymentStatus = "odendi" | "kismi" | "gecikmis" | "bekliyor";

/** Durum saklanmaz, hesaplanır */
export function paymentStatus(p: { expected_amount: number; paid_amount: number; due_date: string | null }, today: string): PaymentStatus {
  if (p.paid_amount >= p.expected_amount) return "odendi";
  if (p.due_date && p.due_date < today) return "gecikmis";
  return p.paid_amount > 0 ? "kismi" : "bekliyor";
}

const payInput = z.object({
  amount: z.coerce.number().int().positive("tutar 0'dan büyük olmalı"),
  date: paymentUpdate.shape.paid_at,
});

/**
 * Tahsilat defteri: payment.paid (tek kayıt) ve payment.corrected (entries) olaylarından tarih bazında tutarlar.
 * Kısmi ödemeler ödendikleri güne yazılır; rapor buradan okunur.
 */
const LEDGER_SQL = `
  SELECT json_extract(data, '$.payment_id') AS payment_id, json_extract(data, '$.amount') AS amount, json_extract(data, '$.date') AS date
  FROM events WHERE type = 'payment.paid'
  UNION ALL
  SELECT json_extract(e.data, '$.payment_id'), json_extract(j.value, '$.amount'), json_extract(j.value, '$.date')
  FROM events e, json_each(e.data, '$.entries') j WHERE e.type = 'payment.corrected'`;

/** Bir ödemenin defterdeki net tutarları (tarih başına) */
export function ledgerOf(ctx: Ctx, paymentId: number): { date: string; amount: number }[] {
  return rows(ctx, `SELECT date, SUM(amount) AS amount FROM (${LEDGER_SQL}) WHERE payment_id = ? GROUP BY date ORDER BY date`, paymentId);
}

/** Bir ayda (YYYY-MM) tahsil edilen toplam */
export function collectedIn(ctx: Ctx, ym: string): number {
  return (row(ctx, `SELECT COALESCE(SUM(amount), 0) AS v FROM (${LEDGER_SQL}) WHERE substr(date, 1, 7) = ?`, ym)?.v ?? 0) as number;
}

export function paymentsService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(paymentCreate, input);
    return ctx.db.transaction((tx) => {
      requireRow(ctx, "projects", d.project_id);
      const r = tx.insert(payments).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, {
        type: "payment.planned", ...link(ctx, { project_id: d.project_id }),
        summary: `Ödeme planlandı: ${label(d.milestone)} ${money(d.expected_amount)}`,
      });
      return { row: r, effects: [] as string[] };
    });
  }

  /**
   * paid_amount / paid_at düzeltme içindir; normal giriş için pay().
   * Tahsilat raporu olaylardan okunduğu için düzeltme, bu ödemenin eski kayıtlarını ters çevirip
   * yeni toplamı yeni tarihe yazan bir payment.corrected olayı üretir.
   */
  function update(id: number, input: unknown) {
    const d = parse(paymentUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "payments", id);
      const expected = d.expected_amount ?? cur.expected_amount;
      const paid = d.paid_amount ?? cur.paid_amount;
      if (paid > expected) throw new FFError("validation", `ödenen (${paid}) beklenenden (${expected}) fazla olamaz`);
      const set: Record<string, unknown> = { ...d };
      if (paid === 0) set.paid_at = null;
      else if (!(d.paid_at ?? cur.paid_at)) set.paid_at = ctx.clock.today();
      const paidAt = (set.paid_at === undefined ? cur.paid_at : set.paid_at) as string | null;
      if (!Object.keys(d).length) return { row: cur, effects: [] as string[] };
      tx.update(payments).set({ ...set, updated_at: ctx.clock.now() }).where(eq(payments.id, id)).run();

      const ledgerChanged = paid !== cur.paid_amount || (paid > 0 && paidAt !== cur.paid_at);
      const entries: { amount: number; date: string }[] = [];
      if (ledgerChanged) {
        for (const e of ledgerOf(ctx, id)) if (e.amount) entries.push({ amount: -e.amount, date: e.date });
        if (paid > 0) entries.push({ amount: paid, date: paidAt! });
      }
      emit(tx, ctx, {
        type: ledgerChanged ? "payment.corrected" : "payment.updated", ...link(ctx, { project_id: cur.project_id }),
        summary: ledgerChanged
          ? `Ödeme düzeltildi: ${label(cur.milestone)} ${money(cur.paid_amount)} → ${money(paid)}`
          : `Ödeme planı güncellendi: ${label(d.milestone ?? cur.milestone)} (${Object.keys(d).join(", ")})`,
        data: { payment_id: id, ...(ledgerChanged ? { entries } : {}) },
      });
      return { row: requireRow(ctx, "payments", id), effects: [] as string[] };
    });
  }

  /** Ödeme girer: tutar paid_amount'a eklenir (kısmi ödeme desteklenir) */
  function pay(id: number, amount: unknown, date?: unknown) {
    const d = parse(payInput, { amount, date });
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "payments", id);
      const remaining = cur.expected_amount - cur.paid_amount;
      if (d.amount > remaining) throw new FFError("rule", `Kalan tutar ${money(remaining)}, fazlası girilemez`);
      const paid = cur.paid_amount + d.amount;
      const at = d.date ?? ctx.clock.today();
      tx.update(payments).set({ paid_amount: paid, paid_at: at, updated_at: ctx.clock.now() }).where(eq(payments.id, id)).run();
      emit(tx, ctx, {
        type: "payment.paid", ...link(ctx, { project_id: cur.project_id }),
        summary: `Ödeme alındı: ${label(cur.milestone)} ${money(d.amount)} (${money(paid)}/${money(cur.expected_amount)})`,
        data: { payment_id: id, amount: d.amount, date: at },
      });
      const effects: string[] = [];
      if (paid >= cur.expected_amount) effects.push("tamamen ödendi");
      if (cur.milestone === "pesinat" && paid >= cur.expected_amount) {
        const pr = row(ctx, "SELECT stage FROM projects WHERE id = ?", cur.project_id);
        if (pr?.stage === "pesinat") effects.push("peşinat tamam, proje ilerleyebilir");
      }
      return { row: requireRow(ctx, "payments", id), effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "payments", id);
    if (cur.paid_amount > 0) throw new FFError("rule", "Ödeme alınmış kayıt silinemez; önce ödenen tutarı düzelt");
    ctx.db.transaction((tx) => {
      tx.delete(comments).where(and(eq(comments.target_type, "payment"), eq(comments.target_id, id))).run();
      tx.delete(payments).where(eq(payments.id, id)).run();
      emit(tx, ctx, { type: "payment.deleted", ...link(ctx, { project_id: cur.project_id }), summary: `Ödeme planı silindi: ${label(cur.milestone)}` });
    });
    return { effects: [] as string[] };
  }

  return { create, update, pay, remove };
}
