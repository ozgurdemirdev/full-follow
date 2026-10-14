import type { Actor } from "../constants";
import { keptRow, type Ctx } from "../context";

/** The event type prefix of a record type when it differs from the type's name (`opp.stage`, `opp.updated`) */
const EVENT_PREFIX: Record<string, string> = { opportunity: "opp" };

/**
 * Events name a person, an opportunity or a project by a column of their own (indexed); every other record
 * keeps its id in the event data as `<type>_id`. Both lookups stay inside the events of the type (`<prefix>.` up to `<prefix>/`,
 * a range on the type index), newest first, one row.
 */
const BY_COLUMN: Record<string, string> = {
  person: "SELECT created_by FROM events WHERE person_id = ? AND type >= ? AND type < ? ORDER BY id DESC LIMIT 1",
  opportunity: "SELECT created_by FROM events WHERE opportunity_id = ? AND type >= ? AND type < ? ORDER BY id DESC LIMIT 1",
  project: "SELECT created_by FROM events WHERE project_id = ? AND type >= ? AND type < ? ORDER BY id DESC LIMIT 1",
};
const BY_DATA = "SELECT created_by FROM events WHERE type >= ? AND type < ? AND json_extract(data, ?) = ? ORDER BY id DESC LIMIT 1";

/** Who made the latest change event of a record (null when it has none yet), for the edit sheet's "Son değişiklik" line */
export function lastActorOf(ctx: Ctx, type: string, id: number): Actor | null {
  const prefix = EVENT_PREFIX[type] ?? type;
  const from = `${prefix}.`;
  const to = `${prefix}/`;
  const found = BY_COLUMN[type]
    ? keptRow<{ created_by: Actor }>(ctx, BY_COLUMN[type], id, from, to)
    : keptRow<{ created_by: Actor }>(ctx, BY_DATA, from, to, `$.${type}_id`, id);
  return found?.created_by ?? null;
}
