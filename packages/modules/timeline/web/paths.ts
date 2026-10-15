/** Where the timeline page lives (the route, the nav item and the record focus links use it) */
export const TIMELINE_PATH = "/zaman";

/** The timeline focused on one record (`type` is the record type of the module that owns it: person, company, opportunity, project ...) */
export const timelinePath = (type: string, id: number) => `${TIMELINE_PATH}/${type}/${id}`;
