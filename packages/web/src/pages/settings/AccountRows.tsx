import { OWNER_NAME_MAX } from "../../../../core/src/constants";
import { api } from "../../api/client";
import { AutoText, ControlSkeleton } from "../../components/settings/Fields";
import { setOwnerName } from "../../lib/owner";
import { putSettings, useSettings, words, type SettingRow } from "../../lib/settings";
import { settings } from "../../messages.settings";

const m = settings.account;

const signOut = async () => {
  try {
    await api.post("/logout", {});
  } finally {
    location.reload();
  }
};

/** The owner's name: saves itself; an emptied field is not sent (a name is required), so it falls back to the saved one */
function OwnerName() {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  const save = async (v: string) => {
    if (!v.trim()) return;
    await putSettings({ owner_name: v });
    setOwnerName(v);
  };
  return <AutoText server={s.data.owner_name ?? ""} save={save} settle={s.reload} label={m.name} maxLength={OWNER_NAME_MAX} />;
}

/** The "Oturum" row exists only when the password is on (the registry decides) */
export const accountRows = (withSession: boolean): SettingRow[] => [
  { id: "name", name: m.name, keywords: words(m.nameKeywords), control: <OwnerName /> },
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
