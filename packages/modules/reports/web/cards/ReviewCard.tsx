import { Link } from "wouter";
import { BoardIcon } from "@kit/components/boardIcons";
import { Card } from "@kit/components/ui";
import { REVIEW_PATH } from "../paths";

/** Shown on Fridays: the weekly review of the current week is ready */
export function ReviewCard() {
  return (
    <Card label="Cuma incelemesi" className="rise">
      <Link href={REVIEW_PATH} className="dash-row flex items-center gap-5 text-text-primary hover:text-text-primary" aria-label="Cuma incelemesi hazır, haftalık inceleme sayfasına git">
        <BoardIcon name="review" className="size-icon-xl flex-none text-accent" />
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="text-md">Cuma incelemesi hazır</span>
          <span className="text-sm text-text-secondary">Bu haftanın sayıları ve gelecek hafta için öneriler</span>
        </span>
        <BoardIcon name="arrowRight" className="size-icon-md flex-none text-text-muted" />
      </Link>
    </Card>
  );
}
