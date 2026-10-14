import type { ReactNode } from "react";

/** Title row of a card without padding (source table, funnel, template compare): title left, optional note or control right */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rep-sechead">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
