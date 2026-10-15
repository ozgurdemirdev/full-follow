// Side panel of the focus view for a person, an opportunity or a project: the record's own cards come from the module that owns it
// (the `timeline.aside` slot, props `{ type, id, detail, touches }`), then the links and the next step, restyled by the shared card classes.
import type { Detail, Opportunity, Person, Project, Touch } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { LinksCard } from "@kit/components/LinksCard";
import type { AsideKind } from "../timeline";

const PATH: Record<AsideKind, string> = { person: "people", opportunity: "opportunities", project: "projects" };
/** The relations a record's detail can bring, each served by the module that owns it (a relation of a module that is not installed is not asked for) */
const WITH: Record<AsideKind, [relation: string, module: string | null][]> = {
  person: [["opportunities", "pipeline"], ["projects", "projects"], ["referrals", null]],
  opportunity: [],
  project: [["payments", null]],
};
/** Detail request of the focused record (the page reads its name from it too) */
export const detailKey = (type: AsideKind, id: number, has: (module: string) => boolean) => {
  const relations = WITH[type].filter(([, module]) => !module || has(module)).map(([relation]) => relation);
  return `/${PATH[type]}/${id}${relations.length ? `?with=${relations.join(",")}` : ""}`;
};

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
