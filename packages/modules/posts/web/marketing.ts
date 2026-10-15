// Paylaşım yenileme notu: "Bugün güncellenecek", "Güncelleme 2 gün gecikti", "Güncelleme 16 Eki"
import type { Post } from "@kit/api/types";
import { daysFrom, fmtDay } from "@kit/lib/format";
import { m } from "./messages";

export function refreshNote(p: Post): { text: string; late: boolean } {
  const d = daysFrom(p.next_refresh_at);
  if (d < 0) return { text: m.refresh.late(-d), late: true };
  if (d === 0) return { text: m.refresh.today, late: true };
  return { text: m.refresh.on(fmtDay(p.next_refresh_at)), late: false };
}
