import { defineModule, DRAFT_STATUSES, MARKETING_DEFAULTS, type RecordTrashed, type TouchCreated, row } from "@fullfollow/core";
import { draftsApi } from "./api";
import { chatCard } from "./chat";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { sendWarnings } from "./service/quota";

/** The follow-up sequence runs once after start and then every hour; FF_AUTO_FOLLOWUP=0 switches it off */
const FOLLOWUP_FIRST_RUN_MS = 3000;
const FOLLOWUP_EVERY_MS = 60 * 60 * 1000;

/**
 * Drafts: drafts Claude (or Özgür) leaves for approval, the follow-up sequence (unanswered messages become follow-up drafts), the daily
 * send limits per channel, the email warmup and the warnings when one is passed. Only Özgür approves, rejects and marks "sent";
 * a sent draft writes its touch through the network module. Templates come from the templates module (a draft without one still works).
 * Its table (drafts) stays in core's schema; removing this package leaves the rows in place.
 */
export default defineModule({
  key: "drafts",
  label: "Taslaklar",
  uses: ["templates", "people", "network", "pipeline", "projects"],
  api: draftsApi,
  entities,
  hooks: {
    /** A touch was written: send warnings (daily limit, email warmup). */
    "touch.created": (ctx, { touch, input, cold }: TouchCreated) => sendWarnings(ctx, input, touch.happened_at.slice(0, 10), cold),
    /**
     * A record goes to the trash: the drafts about an opportunity or project are kept, only their link is emptied (restoring ties them back);
     * a person's and a company's drafts go with them (and the comments on the drafts).
     */
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "opportunity") bin.unlink("drafts", "opportunity_id", id);
      else if (type === "project") bin.unlink("drafts", "project_id", id);
      else if (type === "person" || type === "company") {
        const col = type === "person" ? "person_id" : "company_id";
        bin.take("comments", `target_type = 'draft' AND target_id IN (SELECT id FROM drafts WHERE ${col} = ?)`, id);
        bin.take("drafts", `${col} = ?`, id);
      }
    },
  },
  // the touches of a person or company point at their sent drafts (touches.draft_id), so the drafts are taken after the network module took the touches
  hookOrder: { "record.trashed": 10 },
  contribute: {
    trashTypes: [{ type: "draft", label: "taslak" }],
    commentTargets: {
      draft: {
        table: "drafts",
        label: (ctx, id) => {
          const d = row(ctx, "SELECT p.name FROM drafts d JOIN people p ON p.id = d.person_id WHERE d.id = ?", id);
          return `taslak #${id}${d ? ` (${d.name})` : ""}`;
        },
        link: (ctx, id) => row(ctx, "SELECT person_id, opportunity_id, project_id FROM drafts WHERE id = ?", id) ?? {},
      },
    },
    chatCards: { draft: chatCard },
    // the drafts waiting for approval, the follow-ups that are due (no draft yet) and the daily quota, on the Today view
    today: (ctx, { limit }) => {
      const drafts = ctx.mod("drafts")!;
      const due = drafts.followups.due();
      return {
        drafts: drafts.list({ limit, filter: { status: "bekliyor" } }),
        followups: { rows: due.slice(0, limit), total: due.length },
        quota: drafts.quota(),
      };
    },
    relations: {
      // `get(person | company | opportunity | project | template, id, with: ["drafts"])`; a company's drafts are those written to it or to its people
      drafts: {
        on: ["person", "company", "opportunity", "project", "template"],
        load: (ctx, by, limit) => ctx.mod("drafts")!.list({ filter: by.company_id ? { company_scope: by.company_id } : by, limit }).rows.slice(0, limit),
      },
    },
    meta: { draft_statuses: DRAFT_STATUSES, marketing_defaults: MARKETING_DEFAULTS },
    // follow-up drafts for the unanswered messages, written as Claude ("Claude taslağı"); a run in between creates nothing twice
    jobs: [{
      name: "followups",
      firstRunMs: FOLLOWUP_FIRST_RUN_MS,
      everyMs: FOLLOWUP_EVERY_MS,
      enabled: () => process.env.FF_AUTO_FOLLOWUP !== "0",
      run: (app) => {
        try {
          const r = app.mod("drafts")?.followups.generate();
          if (r?.created.length) console.log(`  Takip taslağı hazırlandı: ${r.effects.join(", ")}`);
        } catch (e) {
          console.warn("  Takip taslakları hazırlanamadı:", e instanceof Error ? e.message : e);
        }
      },
    }],
  },
  mcp,
});
