// Biçimlendiriciler bir kez oluşturulur (her çizimde Intl nesnesi kurmak pahalı)
const num = new Intl.NumberFormat("tr-TR");
const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const dayMonthLong = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });
const dayMonthWeekday = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" });
const monthYear = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("tr-TR", { month: "short" });
const rel = new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" });

export const tl = (n: number | null | undefined) => (n == null ? "—" : `${num.format(n)} ₺`);
/** Amount with the lira sign in front, as the boards write it: ₺84.500 */
export const lira = (n: number) => `₺${num.format(n)}`;
export const fmtNum = (n: number) => num.format(n);
export const pct = (r: number | null | undefined) => (r == null ? "—" : `%${Math.round(r * 100)}`);

/** "2026-10-09" ya da ISO → yerel tarih (saat dilimi kaymasın diye gün tarihleri öğlen alınır) */
export function toDate(s: string): Date {
  return s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
}
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDaysIso(iso: string, days: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const fmtDay = (s: string | null | undefined) => (s ? dayMonth.format(toDate(s)) : "");
export const fmtDayLong = (s: string | null | undefined) => (s ? dayMonthLong.format(toDate(s)) : "");
export const fmtToday = (s: string) => dayMonthWeekday.format(toDate(s));
export const fmtMonth = (ym: string) => cap(monthYear.format(toDate(`${ym}-15`)));
export const fmtMonthShort = (ym: string) => cap(monthShort.format(toDate(`${ym}-15`)));
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);

/** Gün farkı: pozitif = gelecekte */
export function daysFrom(iso: string, from = todayIso()): number {
  return Math.round((toDate(iso.slice(0, 10)).getTime() - toDate(from).getTime()) / 86_400_000);
}

/** "5 saat önce", "dün", "3 gün önce" */
export function ago(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "şimdi";
  if (abs < 3600) return rel.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rel.format(Math.round(diff / 3600), "hour");
  const days = daysFrom(iso);
  if (Math.abs(days) < 7) return rel.format(days, "day");
  return fmtDay(iso);
}

/** Takip tarihi notu: "bugün", "3 gün gecikti", "12 Eki" */
export function followNote(iso: string | null | undefined): { text: string; late: boolean } | null {
  if (!iso) return null;
  const d = daysFrom(iso);
  if (d === 0) return { text: "Bugün takip", late: false };
  if (d < 0) return { text: `${-d} gün gecikti`, late: true };
  if (d === 1) return { text: "Yarın takip", late: false };
  return { text: `Takip ${fmtDay(iso)}`, late: false };
}

export function initials(name: string): string {
  const parts = name.replace(/^(dr|av|prof)\.?\s+/i, "").trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toLocaleUpperCase("tr-TR");
}

/** Türkçe ve büyük/küçük harf duyarsız arama anahtarı */
export function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}

/** File size: "812 KB", "3,4 MB" */
export function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}
