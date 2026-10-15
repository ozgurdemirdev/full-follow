import { useCallback } from "react";
import { useModules } from "../api/modules";
import { useLinkTo } from "../app/modules/registry";
import { PATHS, timelinePath } from "../app/routes";

/** Where a person, project or opportunity name leads: its history when the timeline module is installed, its own page when not */
export function useRecordHref() {
  const { visible } = useModules();
  const linkTo = useLinkTo();
  return useCallback((type: string, id: number) => (visible("timeline") ? timelinePath(type, id) : (linkTo(type, id) ?? PATHS.today)), [visible, linkTo]);
}
