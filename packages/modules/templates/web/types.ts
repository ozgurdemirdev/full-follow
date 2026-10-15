// Types the templates screens own (the Template record itself stays in the kit: the draft form and the weekly review read it too)
import type { Template } from "@kit/api/types";

/** GET /api/templates/:id/render: the template body applied to one person (unknown placeholders stay as they are) */
export interface RenderedTemplate {
  body: string;
  template: Template;
}
export interface TemplateSectorStat {
  sector_path: string;
  sent: number;
  replied: number;
  reply_rate: number;
  early: boolean;
}
export interface TemplateRank {
  id: number;
  name: string;
  sent: number;
  replied: number;
  reply_rate: number | null;
  early: boolean;
  /** best rate of its group, claimed only with at least two non-early templates */
  leader: boolean;
  sectors: TemplateSectorStat[];
}
/** Templates of the same kind and channel (channel null = all channels), ranked */
export interface TemplateGroup {
  kind: Template["kind"];
  channel: string | null;
  templates: TemplateRank[];
}
