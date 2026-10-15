import { useState } from "react";
import { FeedComposer, FeedItems, useFeed, type FeedGroup } from "@kit/components/Feed";
import { Filters } from "@kit/components/ui";

/** Feed filter chips of the opportunity page (events outside these groups only show under "Hepsi") */
const FEED_GROUPS: FeedGroup[] = ["Temaslar", "Yorumlar", "Aşama"];

/** "Akış" of an opportunity page (slot "opportunity.main"): the events, touches and comments of the opportunity with a filter and a composer; `className` is the page's own layout class */
export function OpportunityFeed({ id, label, className }: { id: number; label: string; className: string }) {
  const { events, items, commentById, openThread } = useFeed("opportunity", id);
  const [filter, setFilter] = useState<FeedGroup | "Hepsi">("Hepsi");
  const shown = filter === "Hepsi" ? items : items.filter((x) => x.k.group === filter);
  return (
    <section aria-label="Akış" className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-md font-semibold">Akış</span>
        <span className="flex-grow" />
        <Filters label="Olay türü" value={filter} onChange={setFilter} items={[{ value: "Hepsi" as const, label: "Hepsi" }, ...FEED_GROUPS.map((g) => ({ value: g, label: g }))]} />
      </div>
      <div className="flex flex-col">
        <FeedItems items={shown} commentById={commentById} loaded={!!events.data} />
        <FeedComposer type="opportunity" id={id} label={label} openThread={openThread} />
      </div>
    </section>
  );
}
