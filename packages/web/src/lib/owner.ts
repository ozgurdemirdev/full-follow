// The owner's name (core setting `owner_name`): read with the settings before the app draws, set again by the first run setup and by Settings.
// Every label that names the owner reads it from here; while there is no name the boards say "Sen".
import { useSyncExternalStore } from "react";
import { m } from "../messages";
import { LANG } from "./i18n";

/** How many words of the name give the avatar its letters */
const INITIALS_WORDS = 2;

interface State {
  name: string;
  /** the server sent the field: only then does a missing name open the setup (an older server never asks) */
  known: boolean;
}
let state: State = { name: "", known: false };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** The name as the settings answer has it (undefined: the server has no such setting) */
export function setOwnerName(name: string | undefined) {
  state = { name: name?.trim() ?? "", known: name !== undefined };
  listeners.forEach((fn) => fn());
}

/** The owner as a label says it, for code that runs outside React (the author chips) */
export const ownerLabel = () => state.name || m.owner;

const initialsOf = (label: string) =>
  label.split(/\s+/).filter(Boolean).slice(0, INITIALS_WORDS).map((w) => w.charAt(0).toLocaleUpperCase(LANG)).join("");

/** The owner's name, its label and avatar letters; `needsSetup` while the server knows the setting and it is empty */
export function useOwner() {
  const s = useSyncExternalStore(subscribe, () => state);
  const label = s.name || m.owner;
  return { name: s.name, label, initials: initialsOf(label), needsSetup: s.known && !s.name };
}
