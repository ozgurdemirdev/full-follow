import { defineModule, TEMPLATE_KINDS } from "@fullfollow/core";
import { templatesApi } from "./api";
import { chatCard } from "./chat";
import { entities } from "./entities";
import { mcp } from "./mcp";

/**
 * Templates: message templates with {ad} {firma} {sektor} placeholders, picked by channel and sector, their reply statistics
 * and the A/B comparison per kind and channel. The statistics read the drafts and touches tables directly (they always exist).
 * Its table (templates) stays in core's schema; removing this package leaves the rows in place.
 */
export default defineModule({
  key: "templates",
  label: "Şablonlar",
  smoke: ["/api/templates", "/api/templates/suggest"],
  uses: ["drafts"],
  api: templatesApi,
  entities,
  contribute: {
    trashTypes: [{ type: "template", label: "şablon" }],
    chatCards: { template: chatCard },
    meta: { template_kinds: TEMPLATE_KINDS },
  },
  mcp,
});
