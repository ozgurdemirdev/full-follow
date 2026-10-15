import type { PersonCard } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { Chip } from "@kit/components/ui";
import { IDEA_STAGE, INTEREST, INTEREST_TONE } from "@kit/lib/labels";

/** The ideas a person was told about, in the "Pazarlama" panel of the person overlay (slot "person.overlay.marketing") */
export function PersonIdeas({ card }: { card: PersonCard }) {
  return (
    <>
      {card.ideas.map((x) => (
        <RecordLink key={x.id} type="idea" id={x.idea_id} className="flex flex-wrap items-center gap-2 text-base-sm text-text-neutral-chip">
          <span className="text-text-muted">Fikir ·</span> {x.idea_title}
          <span className="text-text-muted">({IDEA_STAGE[x.idea_stage]})</span>
          <Chip tone={INTEREST_TONE[x.interest]}>{INTEREST[x.interest]}</Chip>
        </RecordLink>
      ))}
    </>
  );
}
