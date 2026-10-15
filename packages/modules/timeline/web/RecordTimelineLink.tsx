import type { ComponentProps } from "react";
import { Link } from "wouter";
import { timelinePath } from "./paths";

type Props = Omit<ComponentProps<"a">, "href" | "id" | "type" | "ref"> & { type: string; id: number; label: string };

/** A link to a record's history, for the slots of other modules' screens (the person overlay, a project, an opportunity): the host passes the record, the label and its own class */
export function RecordTimelineLink({ type, id, label, ...rest }: Props) {
  return <Link href={timelinePath(type, id)} {...rest}>{label}</Link>;
}
