import { defineModule, isoWeekday, isoWeekOf } from "@fullfollow/core";
import { reportsApi } from "./api";
import { REVIEW_WEEKDAY } from "./constants";
import { mcp } from "./mcp";
import { floorOf } from "./service/floor";

/**
 * Reports: the month report against the price floor (what was collected, what is due, the gap), the weekly review with its suggestions
 * ("Göreve çevir" is the calendar's task) and the marketing report. It owns no table. The numbers come from the projects, pipeline, network,
 * drafts, templates, posts and ideas modules; a missing module leaves its part empty, never an error. The price floor is also added to the settings view.
 */
export default defineModule({
  key: "reports",
  label: "Raporlar",
  uses: ["projects", "pipeline", "network", "drafts", "templates", "posts", "ideas", "referrals", "calendar"],
  api: reportsApi,
  contribute: {
    // the weekly review of the current week; ready on Fridays (the dashboard links to it)
    today: (ctx) => {
      const date = ctx.clock.today();
      return { review: { week: isoWeekOf(date), ready: isoWeekday(date) === REVIEW_WEEKDAY } };
    },
    // the subtotal and the floor next to the settings the floor is made of
    settingsView: (_ctx, settings) => floorOf(settings as Parameters<typeof floorOf>[0]),
  },
  mcp,
});
