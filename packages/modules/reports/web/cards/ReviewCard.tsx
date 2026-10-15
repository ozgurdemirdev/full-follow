import { Link } from "wouter";
import { BoardIcon } from "@kit/components/boardIcons";
import { Card } from "@kit/components/ui";
import { m } from "../messages";
import { REVIEW_PATH } from "../paths";

/** Shown on Fridays: the weekly review of the current week is ready */
export function ReviewCard() {
  return (
    <Card label={m.reviewCard.title} className="rise">
      <Link href={REVIEW_PATH} className="dash-row flex items-center gap-5 text-text-primary hover:text-text-primary" aria-label={m.reviewCard.link}>
        <BoardIcon name="review" className="size-icon-xl flex-none text-accent" />
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="text-md">{m.reviewCard.ready}</span>
          <span className="text-sm text-text-secondary">{m.reviewCard.sub}</span>
        </span>
        <BoardIcon name="arrowRight" className="size-icon-md flex-none text-text-muted" />
      </Link>
    </Card>
  );
}
