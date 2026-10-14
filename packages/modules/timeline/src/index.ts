import { defineModule } from "@fullfollow/core";
import { timelineApi } from "./api";
import { mcp } from "./mcp";

/**
 * Timeline: the event history of a person, opportunity or project, the global feed (touches, payments, tasks, stage changes, drafts, comments)
 * with keyset pagination, and the week strip. It owns no table: everything is read from the `events` table. Which events show in the feed,
 * and as what kind, is contributed by the modules that write them (`timelineKinds`); a module that is not installed simply has no rows.
 */
export default defineModule({
  key: "timeline",
  label: "Zaman çizelgesi",
  smoke: ["/api/timeline", "/api/timeline/week"],
  uses: ["network", "projects", "pipeline", "drafts", "calendar"],
  api: timelineApi,
  mcp,
});
