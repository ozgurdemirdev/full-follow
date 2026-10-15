import { Link } from "wouter";
import type { PersonCard, Project } from "@kit/api/types";
import { Chip } from "@kit/components/ui";
import { lira } from "@kit/lib/format";
import { PROJECT_STAGE } from "@kit/lib/labels";
import { useRecordHref } from "@kit/lib/useRecordHref";

/** The projects of a person as rows of the "Satış ve projeler" panel of the person overlay (slot "person.overlay.deals") */
export function PersonProjects({ card }: { card: PersonCard }) {
  const recordHref = useRecordHref();
  return (
    <>
      {card.projects.map((x) => (
        <Link key={`r${x.id}`} href={recordHref("project", x.id)} className="flex items-center gap-3 text-text-primary hover:text-text-primary">
          <span className="min-w-0 flex-grow truncate text-base">{x.name}</span>
          <Chip tone="success">{PROJECT_STAGE[x.stage]}</Chip>
        </Link>
      ))}
    </>
  );
}

/** The projects of a company as rows of the "Projeler ve fırsatlar" panel of the company overlay (slot "company.overlay.work") */
export function CompanyProjects({ projects }: { projects: Project[] }) {
  const recordHref = useRecordHref();
  return (
    <>
      {projects.map((p) => (
        <Link key={`p${p.id}`} href={recordHref("project", p.id)} className="co-work" data-k="won">
          <i />
          <span className="flex min-w-0 flex-grow flex-col"><b>{p.name}</b><small>{PROJECT_STAGE[p.stage]}</small></span>
          <em>{lira(p.price)}</em>
        </Link>
      ))}
    </>
  );
}
