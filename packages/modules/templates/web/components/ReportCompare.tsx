import { useQuery } from "@kit/api/store";
import { MARKETING_KEY } from "../templates";
import type { TemplateGroup } from "../types";
import { TemplateCompare } from "./TemplateCompare";

/** The template comparison section of the report page (the `report.sections` slot) */
export default function ReportCompare() {
  const marketing = useQuery<{ template_groups: TemplateGroup[] }>(MARKETING_KEY);
  return marketing.data ? <TemplateCompare groups={marketing.data.template_groups} /> : null;
}
