import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { Today as TodayData } from "../api/types";
import { useLoaded, useRegistry } from "../app/modules/registry";
import { Slot } from "../app/modules/Slot";
import { Page } from "../app/Page";
import { Masonry } from "../components/layout";
import { Asks } from "../components/dash/Asks";
import { DashTools } from "../components/dash/DashTools";
import { ErrorBox, PageSkeleton } from "../components/ui";
import { fmtToday } from "../lib/format";
import { settings } from "../messages.settings";

const m = settings.today;
const DASH_COLUMNS = 3;

/**
 * Dashboard host: goal strip (a slot), questions waiting for Özgür, then the cards the installed modules registered, in independent
 * masonry columns (global `order` is the order on a phone and inside a column, `column` pins a card to one of the three).
 */
export default function Today() {
  const today = useQuery<TodayData>(K.today);
  const { dashboard } = useRegistry();
  const d = today.data;
  const shown = d ? dashboard.filter((e) => !e.show || e.show(d)) : [];
  // every card's code is there before the masonry draws, so the columns are balanced with real heights
  const cardOf = useLoaded(shown.map((e) => e.load));
  const pinned = Object.fromEntries(shown.flatMap((e) => (e.column === undefined ? [] : [[e.id, e.column] as const])));
  const followUps = (d?.follow_ups?.people?.total ?? 0) + (d?.follow_ups?.opportunities?.total ?? 0);
  // a module that is not installed leaves its part of the sentence out
  const waiting = d ? [d.follow_ups && m.followUps(followUps), d.drafts && m.drafts(d.drafts.total)].filter(Boolean).join(m.and) : "";
  const sub = d ? [fmtToday(d.date), [d.network && m.awaiting(d.network.awaiting.total), waiting && m.waitingOnYou(waiting)].filter(Boolean).join(m.comma)].filter(Boolean).join(m.dot) : "";

  return (
    <Page title={m.greeting} sub={sub} right={<DashTools />} gap="tight" className="flex flex-col gap-9">
      {today.error && !d ? <ErrorBox error={today.error} retry={today.reload} /> : null}
      {!d ? (
        !today.error && <PageSkeleton />
      ) : (
        <>
          <Slot name="dashboard.strip" props={{ today: d }} />
          <Asks />
          {cardOf ? (
            <Masonry columns={DASH_COLUMNS} pinned={pinned}>
              {shown.map((e) => {
                const Card = cardOf(e.load);
                return <Card key={e.id} today={d} />;
              })}
            </Masonry>
          ) : null}
        </>
      )}
    </Page>
  );
}
