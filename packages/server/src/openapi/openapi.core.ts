import { z } from "zod";
import { coreSchemas, docKit, SETTING_KEYS } from "@fullfollow/core";
import type { RouteDocs } from "@fullfollow/core";

const { crud, defineDocs, filtered, flag, limitOf, listOf, object, ok, positiveInt, saveResult } = docKit;
const { commentCreate, commentUpdate, linkCreate, linkUpdate, noteCreate, noteUpdate, sectorCreate, sectorUpdate, sourceCreate, sourceUpdate, tagCreate, tagUpdate } = coreSchemas;
const all = { all: flag("Include hidden (deleted) entries; they still show on the records that use them") };

/** The login routes: the only ones that work without a session */
export const authDocs: RouteDocs = defineDocs({
  "GET /api/me": {
    summary: "Get the session state",
    description: "`auth` is false when no app password is configured; `loggedIn` tells whether this request carries a valid session.",
    response: z.object({ auth: z.boolean(), loggedIn: z.boolean() }),
    public: true,
  },
  "POST /api/login": {
    summary: "Log in with the app password",
    description: "Sets the `ff_session` cookie (30 days). After 8 wrong attempts from one address the answer is 429 for a minute.",
    body: z.object({ password: z.string() }),
    response: ok,
    public: true,
  },
  "POST /api/logout": { summary: "Log out", description: "Clears the session cookie.", response: ok, public: true },
});

/** The routes the server host itself owns: records every module can hang things on, settings, trash and the shared lists */
export const coreDocs: RouteDocs = defineDocs({
  "GET /api/health": { summary: "Check that the server is up", response: ok, public: true },
  "GET /api/modules": {
    summary: "List the installed feature modules",
    response: z.array(z.object({ key: z.string(), label: z.string() })),
  },
  "GET /api/meta": {
    summary: "Get the fixed lists the forms need",
    description: "Tags, channels, touch kinds, stage rules and the other lists; every installed module adds its own entries.",
    response: object,
  },
  "GET /api/today": {
    summary: "Get the Today view",
    description: "What needs attention now; every installed module contributes a section.",
    query: z.object({ limit: limitOf("Rows per section") }),
    response: object,
  },
  "GET /api/settings": { summary: "Read the settings", description: "The stored settings plus the figures installed modules compute from them.", response: object },
  "PUT /api/settings": {
    summary: "Change settings",
    description: "Only the keys sent change. An unknown key is a validation error.",
    body: z.record(z.enum(SETTING_KEYS), z.unknown()),
    response: object,
  },

  ...crud("/api/comments", {
    noun: "comment",
    filters: {
      target_type: z.string().optional().describe("Record type the thread hangs on (person, project, ...)"),
      target_id: positiveInt.optional(),
      unanswered: flag("Open threads whose last comment is Özgür's: waiting for Claude"),
      last_by: z.enum(["ozgur", "claude"]).optional(),
      resolved: z.enum(["true", "false", "all"]).optional().describe("true: closed threads, false (default): open ones, all: both"),
      messages: flag("Return every comment of each thread, not only the first"),
    },
    create: commentCreate,
    update: commentUpdate,
  }),
  "POST /api/comments/:id/resolve": {
    summary: "Close a thread",
    description: "Send `{ \"resolved\": false }` to reopen it.",
    body: z.object({ resolved: z.boolean().optional() }),
    response: saveResult,
  },
  "POST /api/comments/:id/read": { summary: "Mark a thread read", description: "Claude's comments in the thread count as read by Özgür.", response: saveResult },

  "GET /api/files/:id": { summary: "Download a file", description: "Served with the stored mime type; images and PDF open in the tab, the rest downloads.", contentType: "application/octet-stream" },
  "POST /api/files": {
    summary: "Upload a file to a record",
    description: "The record types that accept files are the ones the installed modules allow (an opportunity, a project).",
    multipart: z.object({
      file: z.string().meta({ format: "binary" }).describe("The file"),
      target_type: z.string().describe("Record type"),
      target_id: positiveInt.describe("Record id"),
    }),
    response: saveResult,
  },
  "DELETE /api/files/:id": { summary: "Delete a file", description: "The file goes to the trash and can be restored.", response: saveResult },

  "GET /api/links": {
    summary: "List links",
    description: "Filter by a record with `<type>_id` (for example `project_id=3`); a record also lists the links of the record its module says they come from.",
    query: filtered(),
    response: listOf(),
  },
  "POST /api/links": { summary: "Create a link", body: linkCreate, response: saveResult },
  "PATCH /api/links/:id": { summary: "Update a link", body: linkUpdate, response: saveResult },
  "DELETE /api/links/:id": { summary: "Delete a link", response: saveResult },

  "GET /api/notes": { summary: "List notes", query: filtered({ person_id: positiveInt.optional() }), response: listOf() },
  "POST /api/notes": { summary: "Create a note on a person", body: noteCreate, response: saveResult },
  "PATCH /api/notes/:id": { summary: "Update a note", body: noteUpdate, response: saveResult },
  "DELETE /api/notes/:id": { summary: "Delete a note", response: saveResult },

  ...crud("/api/sectors", { noun: "sector", filters: all, create: sectorCreate, update: sectorUpdate, get: false }),
  ...crud("/api/sources", { noun: "source", filters: all, create: sourceCreate, update: sourceUpdate }),
  ...crud("/api/tags", { noun: "tag", filters: all, create: tagCreate, update: tagUpdate, get: false }),

  "GET /api/trash": {
    summary: "List what was deleted",
    description: "Deleted records and hidden tags, sectors and sources.",
    query: filtered({ type: z.string().optional().describe("Only this record type") }),
    response: listOf(),
  },
  "POST /api/trash/restore": {
    summary: "Restore a deleted record",
    description: "Use the `trash` handle a delete answered with. A person or company whose email was given to another record meanwhile does not come back.",
    body: z.object({ type: z.string(), id: positiveInt }),
    response: saveResult,
  },
});
