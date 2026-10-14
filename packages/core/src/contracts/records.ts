import type { Bin } from "../services/trash";

/**
 * Emitted while a record goes to the trash, inside the delete transaction and before the record's own row is taken.
 * A module that keeps rows pointing at the record cleans them through `bin` (`bin.take(...)` to trash them with it,
 * `bin.unlink(...)` to empty the link); restoring the record puts everything back from the same trash row.
 */
export interface RecordTrashed {
  /** record type of the deleted record ("person", "opportunity", ...) */
  type: string;
  id: number;
  bin: Bin;
}

/** Emitted inside the restore transaction after the record and the rows trashed with it are back */
export interface RecordRestored {
  type: string;
  id: number;
}
