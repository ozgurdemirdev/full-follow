import type { Channel, TemplateKind } from "../constants";
import type { ListOpts } from "../context";
import type { Subject } from "../services/subject";

/** A message template row as stored */
export interface TemplateRecord {
  id: number;
  name: string;
  kind: TemplateKind;
  /** null = every channel */
  channel: Channel | null;
  /** null = every sector */
  sector_id: number | null;
  body: string;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** A template as listed: the row plus its sector path and how it did (drafts made from it, sent ones, answered ones) */
export interface TemplateStats extends TemplateRecord {
  sector_name: string | null;
  sector_path: string | null;
  used: number;
  sent: number;
  replied: number;
  reply_rate: number | null;
  /** fewer sent messages than the sample size that makes a reply rate worth ranking on */
  early: boolean;
  /** enough sent messages and a reply rate so low that the template should be retired ("emekliye ayır") */
  retire: boolean;
  /** one sentence about the template read against the others of its kind and channel; null when there is nothing to say */
  tip: string | null;
}

/** A template that fits a recipient and channel; the higher the score the better it fits */
export interface TemplateSuggestion extends TemplateStats {
  score: number;
}

/** Sent templates of one kind and channel (null channel = all channels), ranked by reply rate; `leader` is set when one clearly wins */
export interface TemplateGroup {
  kind: TemplateKind;
  channel: Channel | null;
  templates: {
    id: number;
    name: string;
    sent: number;
    replied: number;
    reply_rate: number | null;
    early: boolean;
    leader: boolean;
    /** sent messages by the recipient's sector */
    sectors: { sector_path: string; sent: number; replied: number; reply_rate: number; early: boolean }[];
  }[];
}

/**
 * Public API of the templates module (`ctx.mod("templates")`): message templates with {ad} {firma} {sektor} placeholders,
 * their reply statistics and the A/B comparison. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface TemplatesApi {
  create(input: unknown): { row: TemplateRecord; effects: string[] };
  update(id: number, input: unknown): { row: TemplateRecord; effects: string[] };
  /** drafts stay, only their template link is cleared */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** the template text filled for a person, company or bare address (a preview) */
  render(id: number, subject: Subject): { body: string; template: TemplateRecord };
  /** templates that fit the recipient and channel, best first; `kind` narrows to one kind. A recipient is required. */
  suggest(subject: Subject, channel?: string | null, kind?: string | null): TemplateSuggestion[];
  /** filters: kind, channel (a template for all channels fits any), sector (the sector and its sub sectors); q searches name, text and sector */
  list(opts: ListOpts): { rows: TemplateStats[]; total: number };
  get(id: number): TemplateStats | undefined;
  /** the stored row of one template */
  ref(id: number): TemplateRecord | undefined;
  /** every template with its statistics */
  stats(): TemplateStats[];
  /** sent templates grouped by kind and channel (the marketing report) */
  comparison(): TemplateGroup[];
}
