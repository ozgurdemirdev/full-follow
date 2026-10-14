import type { ReactNode } from "react";
import { PageHead } from "../components/ui";

/**
 * Page frame: title and subtitle row (the menu lives in the shell) + content.
 * width: "wide" full width (kanban), "default" 1240, "narrow" 920.
 */
export function Page({
  title, sub, right, children, width = "default", gap, className = "flex flex-col gap-10",
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  width?: "wide" | "default" | "narrow";
  /** "tight": the 20px rhythm of the dashboard and calendar boards instead of 24px */
  gap?: "tight";
  className?: string;
}) {
  return (
    <main className="ff-main">
      <div className="ff-wrap" data-width={width} data-gap={gap}>
        <header className="ff-head">
          <PageHead title={title} sub={sub} />
          {right}
        </header>
        <div className={`min-w-0 ${className}`}>{children}</div>
      </div>
    </main>
  );
}
