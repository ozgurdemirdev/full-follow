import { useMemo } from "react";
import type { Person } from "@kit/api/types";
import { askDraft, compareTouch, draftKind, statusOf, STATUS_LABEL, TOUCH_CARDS, useDayMarks, whyText, type PStatus } from "@kit/lib/people";
import { BoardIcon } from "@kit/components/boardIcons";
import { toast } from "@kit/components/toast";
import { Avatar } from "@kit/components/ui";

/** The statuses that become a card: a follow-up that came due, a reply that is awaited, a cooling relation */
const CARD_STATUSES: PStatus[] = ["due", "wait", "cold"];

/** "Bugün dokun": up to four people to reach out to today; "Yaptım" hides a card for today in this browser */
export function TouchCards({ people, today, onOpen }: { people: Person[]; today: string; onOpen: (id: number, from: HTMLElement) => void }) {
  const [gone, markGone] = useDayMarks("gone");
  const [drafted, markDrafted] = useDayMarks("drafted");
  const cards = useMemo(
    () => people
      .filter((p) => CARD_STATUSES.includes(statusOf(p, today)) && !gone.has(p.id))
      .sort((a, b) => compareTouch(a, b, today))
      .slice(0, TOUCH_CARDS),
    [people, today, gone],
  );

  return (
    <section aria-label="Bugün dokun" className="flex flex-col gap-6">
      <div className="ppl-touch-head">
        <h2 className="m-0 text-section font-light tracking-title">Bugün dokun</h2>
        <span className="text-base-sm text-text-secondary">Claude sıraladı: zamanı gelen, cevapsız kalan, soğuyan</span>
      </div>
      <div className="ppl-touch">
        {cards.map((p) => {
          const s = statusOf(p, today);
          const asked = drafted.has(p.id);
          return (
            <article key={p.id} className="ppl-tcard" data-s={s}>
              <button type="button" className="ppl-who" aria-label={`${p.name} kartını aç`} onClick={(e) => onOpen(p.id, e.currentTarget.closest("article") ?? e.currentTarget)}>
                <Avatar name={p.name} id={p.id} size="tile" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-md font-medium">{p.name}</span>
                  <span className="truncate text-sm text-text-secondary">{p.company_name || p.role}</span>
                </span>
              </button>
              <span className="ppl-tag"><i />{STATUS_LABEL[s]}</span>
              <p className="m-0 flex-grow text-base leading-snug text-text-soft">{whyText(p, s)}</p>
              <div className="ppl-acts">
                <button type="button" className={`ppl-draft ${asked ? "is-asked" : ""}`} onClick={() => { if (!asked) askDraft(p).then(() => markDrafted(p.id)).catch(() => {}); }}>
                  {asked ? "Taslak Taslaklar’da" : `Claude yazsın: ${draftKind(p, s)}`}
                </button>
                <button type="button" className="ppl-done" title="Yaptım" aria-label={`${p.name} için yaptım`} onClick={() => { markGone(p.id); toast(`${p.name.split(" ")[0]} bugün için tamam`); }}>
                  <BoardIcon name="check" className="size-icon-chip" stroke={2.2} />
                </button>
              </div>
            </article>
          );
        })}
        {cards.length === 0 ? <p className="ppl-empty">Bugün dokunman gereken herkese dokundun.</p> : null}
      </div>
    </section>
  );
}
