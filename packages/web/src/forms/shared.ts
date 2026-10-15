// What every form of the sheet shares: its props, the submit guard with validation, saving a record, option lists
import { useMemo, useState, type FormEvent } from "react";
import { report, run } from "../api/actions";
import { useQuery } from "../api/store";
import type { Company, Detail, Mutation, Opportunity, Person, Project } from "../api/types";
import { closeSheet, type SheetState } from "../app/ui";
import type { Option, RemoteSource } from "../components/Combo";
import { CHANNEL, CHANNELS } from "../lib/labels";
import { createSingleFlight } from "../lib/singleFlight";
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
  // a second press (or Enter) while the save is on its way is dropped, so nothing is created twice
  const [once] = useState(createSingleFlight);
  return (e: FormEvent) => {
    e.preventDefault();
    return once(async () => {
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
    });
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

/** The records a task or comment can be about, in the order the picker lists them */
const LINK_TYPES = ["opportunity", "project", "person", "company"] as const;
export type LinkType = (typeof LINK_TYPES)[number];
/** One number for a record of any of those types, so a picker option can stand for it (`linkOf` takes it apart) */
export const linkId = (type: LinkType, tid: number) => tid * LINK_TYPES.length + LINK_TYPES.indexOf(type);
export const linkOf = (id: number | null): { type: LinkType; tid: number } | null => (id ? { type: LINK_TYPES[id % LINK_TYPES.length], tid: Math.floor(id / LINK_TYPES.length) } : null);
const LINK_PATH: Record<LinkType, string> = { opportunity: "/opportunities", project: "/projects", person: "/people", company: "/companies" };

// The pickers ask the server as the text is typed (see Combo `remote`); nothing is held in the browser to filter.
/** Person picker: `/people`, the company as the sub line, the row for the form */
export const PERSON_REMOTE: RemoteSource[] = [{ path: "/people", toOption: (x: Person) => ({ id: x.id, label: x.name, sub: x.company_name ?? undefined, row: x }) }];
/** Company picker: `/companies` */
export const COMPANY_REMOTE: RemoteSource[] = [{ path: "/companies", toOption: (c: Company) => ({ id: c.id, label: c.name, row: c }) }];
/** Company picker of a message: the address as the sub line */
export const COMPANY_CONTACT_REMOTE: RemoteSource[] = [{ path: "/companies", toOption: (c: Company) => ({ id: c.id, label: c.name, sub: c.email ?? c.website ?? undefined, row: c }) }];
/** Anything a task or comment can be about: opportunity, project, person, company (one picker, typed options) */
export const LINK_REMOTE: RemoteSource[] = [
  { path: "/opportunities", toOption: (o: Opportunity) => ({ id: linkId("opportunity", o.id), label: o.title, sub: m.opportunitySub(o.person_name) }) },
  { path: "/projects", toOption: (x: Project) => ({ id: linkId("project", x.id), label: x.name, sub: m.project }) },
  { path: "/people", toOption: (x: Person) => ({ id: linkId("person", x.id), label: x.name, sub: x.company_name ?? m.person }) },
  { path: "/companies", toOption: (x: Company) => ({ id: linkId("company", x.id), label: x.name, sub: m.company }) },
];

/** The option for the record a task or comment is already tied to (edit, or opened from a record): one read of that record; null when it is tied to none */
export function useLinkedOption(linked: Partial<Record<LinkType, number | null | undefined>>): Option | null {
  const type = LINK_TYPES.find((t) => linked[t]);
  const tid = type ? linked[type]! : null;
  const rec = useQuery<Detail<{ title?: string; name?: string }>>(type && tid ? `${LINK_PATH[type]}/${tid}` : null);
  const label = rec.data?.row.title ?? rec.data?.row.name;
  return useMemo(() => (type && tid && label ? { id: linkId(type, tid), label } : null), [type, tid, label]);
}

/** A typed e-mail that is not empty and does not look like one */
export const badEmail = (v: string) => !!v.trim() && !/^\S+@\S+\.\S+$/.test(v.trim());

/** The channels of a message as the chips of a form field */
export const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c, label: CHANNEL[c] }));
