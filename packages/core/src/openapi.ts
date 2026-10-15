/**
 * API documentation kit. A module describes its routes in `src/server/openapi.ts` as a map from "METHOD /api/path/:id" to a `RouteDoc`;
 * the server joins that map with the routes NestJS has registered and writes the OpenAPI 3.1 document (`GET /api/openapi.json`).
 * Request shapes are the module's own Zod schemas, so the documentation cannot drift from what the service accepts.
 */
import { z, type ZodType } from "zod";
import { CONTACT_STATUSES } from "./constants";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
/** "GET /api/tasks/:id": the method and the full path as the controller declares it (path params with a colon) */
export type DocKey = `${HttpMethod} /api${"" | `/${string}`}`;

export interface RouteDoc {
  /** One short English sentence, imperative or descriptive ("List tasks") */
  summary: string;
  /** Longer notes: rules the route enforces, what a value means */
  description?: string;
  /** Query string: a Zod object, one property per parameter */
  query?: ZodType;
  /** JSON request body */
  body?: ZodType;
  /** multipart/form-data request body (a file upload); the file field is named in the schema */
  multipart?: ZodType;
  /** JSON response body */
  response?: ZodType;
  /** Response status when it is not the default (201 for POST, 200 otherwise) */
  status?: number;
  /** Not a JSON answer: a file download or an event stream, named by its content type */
  contentType?: string;
  /** Needs no session even when the app password is set (login, health) */
  public?: boolean;
  /** Descriptions of path parameters; a name ending in "id" is documented as a positive integer, anything else as text */
  params?: Record<string, string>;
}

export type RouteDocs = Partial<Record<DocKey, RouteDoc>>;

/** Typed identity: gives a module's map its key checking */
export const defineDocs = (docs: RouteDocs): RouteDocs => docs;

// ---- Shared shapes ----
export const positiveInt = z.number().int().positive();
/** Any stored row: it has an id, the rest depends on the record type */
export const row = z.looseObject({ id: positiveInt });
/** Any JSON object */
export const object = z.record(z.string(), z.unknown());
export const listQuery = z.object({
  q: z.string().optional().describe("Search text, matched against the record's names and text fields"),
  limit: z.number().int().positive().optional().describe("Rows per page"),
  offset: z.number().int().min(0).optional().describe("Rows to skip"),
});
/** `?x=true` style switch */
export const flag = (what: string) => z.boolean().optional().describe(what);
export const relations = z.string().optional().describe("Comma separated related lists to load with the record, for example `touches,tasks`");
/** { rows, total } as `find` answers */
export const listOf = (item: ZodType = row) => z.looseObject({ rows: z.array(item), total: z.number().int().describe("Rows before limit and offset") });
/** What every write answers: the row, what else happened, and a trash handle when something was deleted */
export const saveResult = z.looseObject({
  row: object.optional().describe("The written record, in the shape of its list rows"),
  effects: z.array(z.string()).describe("Short sentences about what else changed (a project opened, a stage moved)"),
  trash: z.object({ type: z.string(), id: positiveInt }).optional().describe("Present after a delete: restore with POST /api/trash/restore"),
});
export const ok = z.looseObject({ ok: z.boolean() });

/** The list filters of a record type, added to the shared `q`, `limit` and `offset` */
export const filtered = (filters: z.ZodRawShape = {}) => listQuery.extend(filters);

/** The list filters people and companies share (`labelFilter`) */
export const directoryFilters = {
  tag: z.string().optional().describe("Tag id, slug or name; comma separated for several"),
  sector: z.string().optional().describe("Sector id, slug, name or path (\"Sağlık > Diş hekimi\"); a main sector includes its sub sectors"),
  source: z.string().optional().describe("Source id, slug or name"),
  status: z.string().optional().describe(`Contact status, comma separated for several: ${CONTACT_STATUSES.join(", ")}`),
};

export interface CrudOptions {
  /** What the record is called in the summaries ("task", "tag") */
  noun: string;
  /** Query filters of the list (`GET path`) beyond q, limit and offset */
  filters?: z.ZodRawShape;
  create?: ZodType;
  update?: ZodType;
  /** Extra fields of the list route's documentation (a description, a response with more than rows and total) */
  list?: Partial<RouteDoc>;
  /** false: the type has no `GET path/:id` */
  get?: boolean;
  /** false: the type has no `DELETE path/:id` */
  remove?: boolean;
}

/** The five standard routes of a record type: list, read one, create, patch, delete (into the trash) */
export function crud(path: `/api/${string}`, o: CrudOptions): RouteDocs {
  const docs: Partial<Record<string, RouteDoc>> = {
    [`GET ${path}`]: { summary: `List ${o.noun}s`, query: filtered(o.filters), response: listOf(), ...o.list },
  };
  if (o.get !== false) docs[`GET ${path}/:id`] = { summary: `Get one ${o.noun}`, query: z.object({ with: relations }), response: row };
  if (o.create) docs[`POST ${path}`] = { summary: `Create a ${o.noun}`, body: o.create, response: saveResult };
  if (o.update) docs[`PATCH ${path}/:id`] = { summary: `Update a ${o.noun}`, description: "Only the fields sent change.", body: o.update, response: saveResult };
  if (o.remove !== false) docs[`DELETE ${path}/:id`] = { summary: `Delete a ${o.noun}`, description: "The record goes to the trash and can be restored.", response: saveResult };
  return docs as RouteDocs;
}
