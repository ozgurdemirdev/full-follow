import type { Template } from "./types";

/** GET /api/templates/:id/render: the template body applied to one person (unknown placeholders stay as they are) */
export interface RenderedTemplate {
  body: string;
  template: Template;
}
