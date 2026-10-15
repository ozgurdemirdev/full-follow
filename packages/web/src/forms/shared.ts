// What every form of the sheet shares: its props, the submit guard with validation, saving a record, option lists
import { useMemo, type FormEvent } from "react";
import { report, run } from "../api/actions";
import { useCompanies, useOpps, usePeople, useProjects } from "../api/keys";
import type { Mutation } from "../api/types";
import { closeSheet, type SheetState } from "../app/ui";
import type { Option } from "../components/Combo";
import { CHANNEL, CHANNELS } from "../lib/labels";
import { forms } from "../messages.forms";
import { formMeta } from "./meta";

const m = forms.shared;

export interface FormProps {
  sheet: SheetState;
  formId: string;
  setBusy: (b: boolean) => void;
  /** show field errors in the sheet (an empty object clears them and the duplicate banner) */
  setErrors: (errors: Record<string, string>) => void;
}

/** Errors keyed by field name from "message or false" rules: `errorsOf({ name: !name.trim() && "Ad gerekli" })` */
export function errorsOf(rules: Record<string, string | false | null | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(rules).filter((e): e is [string, string] => !!e[1]));
}

/**
 * The submit handler of a form: validates (field errors appear in the sheet and nothing is sent), then runs `fn`
 * once at a time and closes the sheet on success. A failed write shows its error (a duplicate becomes the sheet's banner).
 */
export function useSubmit(p: FormProps, fn: () => Promise<unknown>, validate?: () => Record<string, string>) {
  return async (e: FormEvent) => {
    e.preventDefault();
    const errors = validate?.() ?? {};
    p.setErrors(errors);
    if (Object.keys(errors).length) return;
    p.setBusy(true);
    try {
      await fn();
      closeSheet();
    } catch (err) {
      report(err);
    } finally {
      p.setBusy(false);
    }
  };
}

/**
 * Create or edit one record of the sheet's type: POST to the base path, or PATCH when `editId` is set.
 * The toast reads "<Tür> eklendi" / "<Tür> güncellendi" and carries the "Aç" pill to the record.
 */
export function saveRecord<T>(p: FormProps, editId: number | null | undefined, body: unknown, createBody: unknown = body) {
  const { noun, base, page } = formMeta(p.sheet.kind)!;
  if (editId) return run<T>("patch", `${base}/${editId}`, body, { ok: m.updated(noun), open: page(editId, p.sheet.preset) });
  return run<T>("post", base, createBody, { ok: m.created(noun), open: (r: Mutation<T>) => page((r.row as { id?: number } | undefined)?.id, p.sheet.preset) });
}

/** Anything a task or comment can be about: opportunity, project, person, company (one list, typed options) */
export type LinkOption = Option & { type: "opportunity" | "project" | "person" | "company"; tid: number };
export function useLinkOptions(): LinkOption[] {
  const people = usePeople();
  const companies = useCompanies();
  const opps = useOpps();
  const projects = useProjects();
  return useMemo(() => {
    const list: LinkOption[] = [];
    let n = 0;
    for (const o of opps.rows) list.push({ id: ++n, label: o.title, sub: m.opportunitySub(o.person_name), type: "opportunity", tid: o.id });
    for (const x of projects.rows) list.push({ id: ++n, label: x.name, sub: m.project, type: "project", tid: x.id });
    for (const x of people.rows) list.push({ id: ++n, label: x.name, sub: x.company_name ?? m.person, type: "person", tid: x.id });
    for (const x of companies.rows) list.push({ id: ++n, label: x.name, sub: m.company, type: "company", tid: x.id });
    return list;
  }, [opps.rows, projects.rows, people.rows, companies.rows]);
}

export function usePersonOptions(): Option[] {
  const people = usePeople();
  return useMemo(() => people.rows.map((x) => ({ id: x.id, label: x.name, sub: x.company_name ?? undefined })), [people.rows]);
}

export function useCompanyOptions(withContact = false): Option[] {
  const companies = useCompanies();
  return useMemo(
    () => companies.rows.map((c) => ({ id: c.id, label: c.name, sub: withContact ? (c.email ?? c.website ?? undefined) : undefined })),
    [companies.rows, withContact],
  );
}

/** A typed e-mail that is not empty and does not look like one */
export const badEmail = (v: string) => !!v.trim() && !/^\S+@\S+\.\S+$/.test(v.trim());

/** The channels of a message as the chips of a form field */
export const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c, label: CHANNEL[c] }));
