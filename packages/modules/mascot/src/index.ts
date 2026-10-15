import { defineModule } from "@fullfollow/core";
import { m } from "./messages";

/**
 * Mascot: the jellyfish that floats over the panel and opens the chat. It has no tables, no endpoints and no MCP part;
 * the module exists so the web part (packages/modules/mascot/web) can be switched off, hidden in Settings or removed like any other.
 */
export default defineModule({ key: "mascot", label: m.label });
