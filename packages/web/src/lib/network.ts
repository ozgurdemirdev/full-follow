// Contact channel names and the links to a website or an account: shared by the people, companies, network, drafts and templates screens
import { CHANNEL } from "./labels";

export const channelName = (c: string | null | undefined) => (c ? (CHANNEL[c] ?? c) : "");

/** Website as typed (with or without the scheme) → link */
export const webUrl = (v: string): string => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

/** Instagram / LinkedIn kullanıcı adı ya da adresi → bağlantı */
export function profileUrl(kind: "instagram" | "linkedin", v: string): string {
  if (/^https?:\/\//i.test(v)) return v;
  const h = v.replace(/^@/, "").trim();
  return kind === "instagram" ? `https://instagram.com/${h}` : `https://www.linkedin.com/in/${h}`;
}
