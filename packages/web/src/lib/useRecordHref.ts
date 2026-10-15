import { useCallback } from "react";
import { useRegistry } from "../app/modules/registry";
import { PATHS } from "../app/routes";

/** Where a person, project or opportunity name leads: its history when a timeline page is there, its own page when not */
export function useRecordHref() {
  const { link, pagePath } = useRegistry();
  return useCallback((type: string, id: number) => {
    const history = pagePath("timeline");
    return history ? `${history}/${type}/${id}` : (link(type, id) ?? PATHS.today);
  }, [link, pagePath]);
}
