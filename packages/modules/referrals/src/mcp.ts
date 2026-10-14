import type { McpDef } from "@fullfollow/core";

/** The referral line of the `report` tool is written by the generic report text; this adds its words to the tool description */
export const mcp: McpDef = {
  docs: {
    report: [{ at: 110, text: "referans değeri, " }],
  },
};
