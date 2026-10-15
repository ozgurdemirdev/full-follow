import type { PersonCard } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { PLATFORM } from "@kit/lib/labels";
import { m } from "./messages";

/** The post a person came from, in the "Pazarlama" panel of the person overlay (slot "person.overlay.marketing") */
export function PersonPost({ card }: { card: PersonCard }) {
  if (!card.post) return null;
  return (
    <RecordLink type="post" id={card.post.id} className="text-base-sm">
      <span className="text-text-muted">{m.person.source}</span>{PLATFORM[card.post.platform]} · {card.post.title}
    </RecordLink>
  );
}
