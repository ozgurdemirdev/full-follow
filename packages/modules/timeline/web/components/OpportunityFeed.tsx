import { useState } from "react";
import { Filters } from "@kit/components/ui";
import { m } from "../messages";
import { FeedComposer, FeedItems, useFeed, type FeedGroup } from "./Feed";

/** Feed filter chips of the opportunity page (events outside these groups only show under "Hepsi") */
const FEED_GROUPS: FeedGroup[] = [m.feedGroups.touches, m.feedGroups.comments, m.feedGroups.stage];
/** The filter value of "every group" */
const ALL_GROUPS = "";

/** The "Akış" section of the opportunity page (the `opportunity.feed` slot): its events, touches and comments, and the comment box */
export default function OpportunityFeed({ id, label }: { id: number; label: string }) {
  const { events, items, commentById, openThread } = useFeed("opportunity", id);
  const [filter, setFilter] = useState<FeedGroup>(ALL_GROUPS);
  const shown = filter === ALL_GROUPS ? items : items.filter((x) => x.k.group === filter);
  return (
    <section aria-label={m.feed.title} className="order-6 flex min-w-0 flex-col gap-5 desk:order-none">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-md font-semibold">{m.feed.title}</span>
        <span className="flex-grow" />
        <Filters label={m.filters.eventType} value={filter} onChange={setFilter} items={[{ value: ALL_GROUPS, label: m.shared.all }, ...FEED_GROUPS.map((g) => ({ value: g, label: g }))]} />
      </div>
      <div className="flex flex-col">
        <FeedItems items={shown} commentById={commentById} loaded={!!events.data} />
        <FeedComposer type="opportunity" id={id} label={label} openThread={openThread} />
      </div>
    </section>
  );
}
