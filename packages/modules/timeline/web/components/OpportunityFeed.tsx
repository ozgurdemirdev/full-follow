import { useState } from "react";
import { Filters } from "@kit/components/ui";
import { FeedComposer, FeedItems, useFeed, type FeedGroup } from "./Feed";

/** Feed filter chips of the opportunity page (events outside these groups only show under "Hepsi") */
const FEED_GROUPS: FeedGroup[] = ["Temaslar", "Yorumlar", "Aşama"];

/** The "Akış" section of the opportunity page (the `opportunity.feed` slot): its events, touches and comments, and the comment box */
export default function OpportunityFeed({ id, label }: { id: number; label: string }) {
  const { events, items, commentById, openThread } = useFeed("opportunity", id);
  const [filter, setFilter] = useState<FeedGroup | "Hepsi">("Hepsi");
  const shown = filter === "Hepsi" ? items : items.filter((x) => x.k.group === filter);
  return (
    <section aria-label="Akış" className="order-6 flex min-w-0 flex-col gap-5 desk:order-none">
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
