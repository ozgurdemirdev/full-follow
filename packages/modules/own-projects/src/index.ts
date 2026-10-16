import { defineModule, row } from "@fullfollow/core";
import { ownProjectsApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { m } from "./messages";

/**
 * Own projects: the owner's own products (Full Follow), their status, sellability and sectors. Their ideas belong to the ideas module,
 * which also hands an idea over when it becomes a project.
 * Its tables (own_projects, own_project_sectors) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "own-projects",
  label: m.label,
  smoke: ["/api/own-projects"],
  uses: ["ideas"],
  api: ownProjectsApi,
  entities,
  contribute: {
    trashTypes: [{ type: "own_project", label: m.project }],
    commentTargets: {
      own_project: { table: "own_projects", label: (ctx, id) => row(ctx, "SELECT name FROM own_projects WHERE id = ?", id)?.name ?? `#${id}`, links: true },
    },
  },
  mcp,
});
