import type { ChatCard } from "@fullfollow/core";

/** Longest text shown on a chip */
const SNIPPET = 80;
const clip = (s: string) => (s.length > SNIPPET ? `${s.slice(0, SNIPPET - 1)}…` : s);

/** What the panel chat shows on a draft chip: the recipient, channel, status and the start of the text */
export const chatCard: ChatCard = (ctx, id) => {
  const r = ctx.mod("drafts")!.get(id);
  if (!r) throw new Error("draft not found");
  return { title: r.to_name ?? r.person_name ?? r.contact ?? `Taslak #${id}`, channel: r.channel, status: r.status, body: clip(String(r.body ?? "")) };
};
