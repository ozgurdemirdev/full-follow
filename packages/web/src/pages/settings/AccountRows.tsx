import { api } from "../../api/client";
import { ACTOR } from "../../lib/labels";
import { words, type SettingRow } from "../../lib/settings";
import { settings } from "../../messages.settings";

const m = settings.account;

const signOut = async () => {
  try {
    await api.post("/logout", {});
  } finally {
    location.reload();
  }
};

/** The "Oturum" row exists only when the password is on (the registry decides) */
export const accountRows = (withSession: boolean): SettingRow[] => [
  { id: "name", name: m.name, keywords: words(m.nameKeywords), control: <span className="set-text">{ACTOR.ozgur}</span> },
  ...(withSession
    ? [{
      id: "session",
      name: m.session,
      hint: m.sessionHint,
      keywords: words(m.sessionKeywords),
      control: <button type="button" className="set-btn" onClick={() => void signOut()}>{m.signOut}</button>,
    }]
    : []),
];
