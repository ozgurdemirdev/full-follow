import type { ReactNode } from "react";

/** Card title row; `data-setting` lets the settings search highlight the title of a card that has no labelled field */
export function Head({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="card-title flex-grow" data-setting={title}>{title}</h2>
      {children}
    </div>
  );
}
