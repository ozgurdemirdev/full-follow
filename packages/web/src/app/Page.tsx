import type { ReactNode } from "react";
import { Icon } from "../components/icons";
import { PageHead } from "../components/ui";
import { setUI } from "./ui";

/**
 * Sayfa iskeleti: başlık satırı (mobilde menü düğmesi) + içerik.
 * width: "wide" tam genişlik (kanban), "default" 1240, "narrow" 920.
 */
export function Page({
  title, sub, right, children, width = "default", className = "flex flex-col gap-9",
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  width?: "wide" | "default" | "narrow";
  className?: string;
}) {
  const max = width === "narrow" ? "max-w-content-narrow" : "";
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-5 px-page-padding-x-mobile pb-1 pt-6 desk:px-page-padding-x desk:pb-3 desk:pt-9">
        <button type="button" className="ibtn desk:hidden" aria-label="Menüyü aç" onClick={() => setUI({ drawer: true })}>
          <Icon name="menu" className="size-icon-xl" />
        </button>
        <PageHead title={title} sub={sub} />
        {right}
      </header>
      <div className={`w-full min-w-0 px-page-padding-x-mobile pb-content-bottom-pad pt-3 desk:px-page-padding-x desk:pt-5 ${max} ${className}`}>{children}</div>
    </main>
  );
}
