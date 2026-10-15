import type { ReactNode } from "react";
import { Link } from "wouter";
import { useLinkTo } from "../app/modules/registry";

/** A link to the page of a record: plain text when no installed, visible module serves the record type (see `linkTo`) */
export function RecordLink({ type, id, className, children }: { type: string; id: number; className?: string; children: ReactNode }) {
  const href = useLinkTo()(type, id);
  return href ? <Link href={href} className={className}>{children}</Link> : <span className={className}>{children}</span>;
}
