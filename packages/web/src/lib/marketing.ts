// Paylaşım yenileme notu: "Bugün güncellenecek", "Güncelleme 2 gün gecikti", "Güncelleme 16 Eki"
import type { Post } from "../api/types";
import { daysFrom, fmtDay } from "./format";

export function refreshNote(p: Post): { text: string; late: boolean } | null {
  if (!p.next_refresh_at) return null;
  const d = daysFrom(p.next_refresh_at);
  if (d < 0) return { text: `Güncelleme ${-d} gün gecikti`, late: true };
  if (d === 0) return { text: "Bugün güncellenecek", late: true };
  return { text: `Güncelleme ${fmtDay(p.next_refresh_at)}`, late: false };
}
