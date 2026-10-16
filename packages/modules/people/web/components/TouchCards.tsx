import { useMemo } from "react";
import { qs } from "@kit/api/client";
import { useQuery } from "@kit/api/store";
import type { Person } from "@kit/api/types";
import { useCanAsk } from "@kit/lib/askClaude";
import { AskButton } from "@kit/components/AskButton";
import { draftKind, draftRequest, statusOf, useDayMarks } from "@kit/lib/people";
import { STATUS_LABEL, TOUCH_CARDS, whyText } from "../people";
import { BoardIcon } from "@kit/components/boardIcons";
import { toast } from "@kit/components/toast";
import { Avatar } from "@kit/components/ui";

import { m } from "../messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** People asked of the touch queue: the cards show the first TOUCH_CARDS of them that are not marked done today in this browser */
const QUEUE_FETCH = 24;

/** "Bugün dokun": up to four people to reach out to today; "Yaptım" hides a card for today in this browser */
export function TouchCards({ today, onOpen }: { today: string; onOpen: (id: number, from: HTMLElement) => void }) {
  const [gone, markGone] = useDayMarks("gone");
  const canAsk = useCanAsk();
  // the server orders the people that need a touch (due follow-ups, awaited replies, cooling relations); the cards take the first ones not done today
  const queue = useQuery<{ rows: Person[] }>(`/people/touch-queue${qs({ limit: QUEUE_FETCH })}`);
  const people = queue.data?.rows;
  const cards = useMemo(() => (people ?? []).filter((p) => !gone.has(p.id)).slice(0, TOUCH_CARDS), [people, gone]);

  return (
    <section aria-label={m.touch.title} className="flex flex-col gap-6">
      <div className="ppl-touch-head">
        <h2 className="m-0 text-section font-light tracking-title">{m.touch.title}</h2>
        <span className="text-base-sm text-text-secondary">{m.touch.sub}</span>
      </div>
      <div className="ppl-touch">
        {cards.map((p) => {
          const s = statusOf(p, today);
          const request = draftRequest(p);
          return (
            <article key={p.id} className="ppl-tcard" data-s={s}>
              <button type="button" className="ppl-who" aria-label={m.touch.open(p.name)} onClick={(e) => onOpen(p.id, e.currentTarget.closest("article") ?? e.currentTarget)}>
                <Avatar name={p.name} id={p.id} size="tile" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-md font-medium">{p.name}</span>
                  <span className="truncate text-sm text-text-secondary">{p.company_name || p.role}</span>
                </span>
              </button>
              <span className="ppl-tag"><i />{STATUS_LABEL[s]}</span>
              <p className="m-0 flex-grow text-base leading-snug text-text-soft">{whyText(p, s)}</p>
              <div className="ppl-acts">
                {canAsk(request) ? (
                  <AskButton request={request} className={(asked) => `ppl-draft ${asked ? "is-asked" : ""}`} label={m.touch.claudeWrites(draftKind(p, s))} askedLabel={m.touch.drafted} />
                ) : null}
                <button type="button" className="ppl-done" title={m.touch.done} aria-label={m.touch.doneFor(p.name)} onClick={() => { markGone(p.id); toast(m.touch.doneToast(p.name.split(" ")[0])); }}>
                  <BoardIcon name="check" className="size-icon-chip" stroke={STROKE.medium} />
                </button>
              </div>
            </article>
          );
        })}
        {cards.length === 0 ? <p className="ppl-empty">{m.touch.empty}</p> : null}
      </div>
    </section>
  );
}
