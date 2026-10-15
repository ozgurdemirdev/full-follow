import type { ChatCard } from "@fullfollow/core";
import { m } from "./messages";

/** Stored text, reply stats, and the text filled for the person with the same placeholder fill the follow-up drafts use (`template:5@12`) */
export const chatCard: ChatCard = (ctx, id, personId) => {
  const templates = ctx.mod("templates")!;
  const t = templates.get(id);
  if (!t) throw new Error(m.notFound);
  let filled: string | null = null;
  let forName: string | null = null;
  if (personId) {
    filled = templates.render(id, { person_id: personId }).body;
    forName = ctx.mod("people")?.get(personId)?.name ?? null;
  }
  return {
    title: t.name, kind: t.kind, channel: t.channel, body: t.body, filled, for_name: forName, person_id: personId ?? null,
    used: t.used, sent: t.sent, replied: t.replied, reply_rate: t.reply_rate,
  };
};
