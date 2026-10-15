/** Where the sales funnel board lives (the route, the nav item, the links and the web marker use it) */
export const PIPELINE_PATH = "/huni";
/** The opportunity page: `/firsatlar/:id` */
export const OPPORTUNITY_PATH = "/firsatlar";

export const opportunityPath = (id: number) => `${OPPORTUNITY_PATH}/${id}`;
