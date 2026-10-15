import { useMemo, useState } from "react";
import type { Person, PersonCard } from "@kit/api/types";
import { statusOf } from "@kit/lib/people";
import { Skeleton } from "@kit/components/ui";
import { Composer, type Mode } from "./Composer";
import { Stream } from "./Stream";
import { buildStream, type StreamFilter } from "./streamItems";

/**
 * The right column of the person overlay (slot "person.overlay.main" of the people page): the composer for a touch, a note or a comment
 * for Claude, and the stream of them. `chan` is the channel picked in the left column.
 */
export function PersonStream({ person, card, chan }: { person: Person; card?: PersonCard; chan: string | null }) {
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [mode, setMode] = useState<Mode>("touch");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const items = useMemo(() => (card ? buildStream(card) : []), [card]);
  const status = statusOf(person);
  const changeMode = (next: Mode) => { setMode(next); if (next !== "claude") setReplyTo(null); };

  return (
    <div className="ppl-col min-w-0">
      <Composer person={person} mode={mode} onMode={changeMode} replyTo={replyTo} onSent={() => setReplyTo(null)} />
      {card ? (
        <Stream items={items} person={person} status={status} filter={filter} onFilter={setFilter} chan={chan}
          onAnswer={() => setMode("touch")} onReply={(thread) => { setMode("claude"); setReplyTo(thread); }} />
      ) : <Skeleton className="h-chart-height" />}
    </div>
  );
}
