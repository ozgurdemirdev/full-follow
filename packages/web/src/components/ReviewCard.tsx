import { Link } from "wouter";
import { PATHS } from "../app/routes";
import { Icon } from "./icons";

/** Dashboard link card shown on Fridays: the weekly review of the current week is ready */
export function ReviewCard() {
  return (
    <Link href={PATHS.review} className="flex items-center gap-5 rounded-inner border border-border-subtle px-9 py-6 text-text-primary hover:border-border-strong hover:text-text-primary" aria-label="Cuma incelemesi hazır, haftalık inceleme sayfasına git">
      <Icon name="review" className="size-icon-lg flex-none text-accent-text" />
      <span className="flex min-w-0 flex-grow flex-col">
        <span className="text-base font-medium">Cuma incelemesi hazır</span>
        <span className="text-sm text-text-secondary">Bu haftanın sayıları ve gelecek hafta için öneriler</span>
      </span>
      <Icon name="arrow" className="size-icon-sm flex-none text-text-muted" />
    </Link>
  );
}
