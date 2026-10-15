import type { ComponentProps } from "react";
import { Link } from "wouter";
import { useLinkTo } from "./registry";

type Props = Omit<ComponentProps<"a">, "href" | "id" | "type" | "ref"> & { type: string; id: number };

/** A link to a record's page; the children as plain text when no visible module serves that record type (a module screen never names another module's path) */
export function RecordLink({ type, id, children, ...rest }: Props) {
  const href = useLinkTo()(type, id);
  return href ? <Link href={href} {...rest}>{children}</Link> : <span className={rest.className}>{children}</span>;
}
