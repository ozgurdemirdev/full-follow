import { useCallback } from "react";
import { useModules } from "../api/modules";
import { PATHS, recordPath, timelinePath } from "../app/routes";

/** Where a person, project or opportunity name leads: its history when the timeline module is installed, its own page when not */
export function useRecordHref() {
  const { has } = useModules();
  return useCallback((type: string, id: number) => (has("timeline") ? timelinePath(type, id) : (recordPath(type, id) ?? PATHS.today)), [has]);
}
