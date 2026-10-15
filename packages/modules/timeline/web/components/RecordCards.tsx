// Side panel of the focus view for a person, an opportunity or a project: the record's own cards come from the module that owns it
// (the `timeline.aside` slot, props `{ type, id, detail, touches }`), then the links and the next step, restyled by the shared card classes.
import type { Detail, Opportunity, Person, Project, Touch } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { LinksCard } from "@kit/components/LinksCard";
import type { AsideKind } from "../timeline";

const PATH: Record<AsideKind, string> = { person: "people", opportunity: "opportunities", project: "projects" };
const WITH: Record<AsideKind, string> = { person: "opportunities,projects,referrals", opportunity: "", project: "payments" };
/** Detail request of the focused record (the page reads its name from it too) */
export const detailKey = (type: AsideKind, id: number) => `/${PATH[type]}/${id}${WITH[type] ? `?with=${WITH[type]}` : ""}`;

export type AnyRow = Omit<Person, "stage"> & Omit<Opportunity, "stage"> & Omit<Project, "stage"> & { stage: string };

/** The cards of the focused record, below the board's feed on phones and beside it on desktop */
export function RecordAside({ type, id, detail, touches }: { type: AsideKind; id: number; detail: Detail<any>; touches: Touch[] }) {
  const row = detail.row as AnyRow;
  const personId = type === "person" ? id : row.person_id;
  return (
    <aside className="tlx-aside">
      <Slot name="timeline.aside" props={{ type, id, detail, touches }} />
      {type !== "person" ? <LinksCard type={type} id={id} /> : null}
      <Slot name="timeline.next-step" props={{ type, id, personId }} />
    </aside>
  );
}
