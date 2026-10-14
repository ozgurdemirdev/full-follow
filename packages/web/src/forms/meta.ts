// What each form sheet says about itself lives in the manifest of the module that owns the record type (quickAdd entry, `form`);
// these helpers look it up by the sheet's kind.
import { currentRegistry } from "../app/modules/registry";
import type { FormMeta } from "../app/modules/types";
import type { SheetState } from "../app/ui";

export type { FormMeta };

/** The meta of a kind, or undefined when its module is not installed or hidden */
export const formMeta = (kind: string): FormMeta | undefined => currentRegistry().quickByKind.get(kind)?.form;

/** The record a sheet edits, or null when it adds a new one */
export const editOf = (sheet: SheetState): number | null => formMeta(sheet.kind)?.editId?.(sheet.preset ?? {}) ?? null;
