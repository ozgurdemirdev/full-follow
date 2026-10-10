// Network durum metinleri: cevap bekliyor / soğuyor / son temas
import type { Person } from "../api/types";
import { CHANNEL, type Tone } from "./labels";

export const channelName = (c: string | null | undefined) => (c ? (CHANNEL[c] ?? c) : "");

const days = (n: number) => (n === 0 ? "bugün" : n === 1 ? "dün" : `${n} gün`);

/** Kişinin network durumu tek satır: liste satırı ve kart başlığı */
export function netStatus(p: Pick<Person, "awaiting" | "cooling" | "last_touch_at" | "last_channel" | "days_since">): { text: string; tone: Tone; late: boolean } | null {
  if (p.awaiting) {
    const a = p.awaiting;
    const when = a.days === 0 ? "bugün yazıldı" : `${a.days} gündür`;
    return { text: `Cevap bekliyor · ${channelName(a.channel)} · ${when}${a.attempts > 1 ? ` · ${a.attempts}. mesaj` : ""}`, tone: a.late ? "warning" : "opportunity", late: a.late };
  }
  if (p.cooling) return { text: `Soğuyor · ${p.days_since} gündür temas yok`, tone: "payment", late: true };
  if (p.last_touch_at) return { text: `Son temas ${channelName(p.last_channel)} · ${p.days_since === 0 ? "bugün" : `${days(p.days_since)}${p.days_since > 1 ? " önce" : ""}`}`, tone: "neutral", late: false };
  return null;
}

/** Instagram / LinkedIn kullanıcı adı ya da adresi → bağlantı */
export function profileUrl(kind: "instagram" | "linkedin", v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, "").trim();
  return kind === "instagram" ? `https://instagram.com/${h}` : `https://www.linkedin.com/in/${h}`;
}
