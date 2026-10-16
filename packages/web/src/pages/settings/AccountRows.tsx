import { useState, type FormEvent } from "react";
import { OWNER_NAME_MAX, OWNER_PASSWORD_MAX, OWNER_PASSWORD_MIN } from "../../../../core/src/constants";
import { api, ApiError } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { AutoText, ControlSkeleton } from "../../components/settings/Fields";
import { Switch } from "../../components/settings/Parts";
import { toast } from "../../components/toast";
import { setOwnerName } from "../../lib/owner";
import { putSettings, useSettings, words, type SettingRow } from "../../lib/settings";
import { m as kit } from "../../messages";
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

/** The change form in the app's dialog: the current password, the new one twice. Every other session ends; this browser stays in. */
function ChangePassword({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const typed = (set: (v: string) => void) => (e: { target: { value: string } }) => (set(e.target.value), setError(""));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if ([...next].length < OWNER_PASSWORD_MIN) return setError(m.passwordShort(OWNER_PASSWORD_MIN));
    if (again !== next) return setError(m.passwordMismatch);
    setBusy(true);
    try {
      await api.post("/password", { current, password: next });
      toast(m.passwordChanged);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : m.passwordFailed);
      setBusy(false);
    }
  };

  const field = (value: string, set: (v: string) => void, label: string, autoComplete: string) => (
    <input className="set-input dlg-input" type="password" aria-label={label} placeholder={label} value={value} onChange={typed(set)}
      autoComplete={autoComplete} maxLength={OWNER_PASSWORD_MAX} aria-invalid={!!error} />
  );
  return (
    <Dialog label={m.passwordChange} onCancel={onClose}>
      <form className="dlg-form" onSubmit={submit} noValidate>
        <h2 className="dlg-title">{m.passwordChange}</h2>
        <p className="dlg-text">{m.passwordChangeBody(OWNER_PASSWORD_MIN)}</p>
        {field(current, setCurrent, m.passwordCurrent, "current-password")}
        {field(next, setNext, m.passwordNew, "new-password")}
        {field(again, setAgain, m.passwordAgain, "new-password")}
        {error ? <p className="dlg-error" role="alert">{error}</p> : null}
        <div className="dlg-foot">
          <button type="button" className="dlg-btn" onClick={onClose}>{kit.cancel}</button>
          <button type="submit" className="dlg-btn is-primary" aria-busy={busy} disabled={busy}>{m.passwordSave}</button>
        </div>
      </form>
    </Dialog>
  );
}

function ChangePasswordButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="set-btn" onClick={() => setOpen(true)}>{m.passwordChange}</button>
      {open ? <ChangePassword onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** "Telefondan erişim": read by the server when it starts, so the switch says so in its row */
function PhoneAccess() {
  const s = useSettings();
  if (!s.data) return s.loading ? <ControlSkeleton /> : null;
  return <Switch label={m.phone} on={!!s.data.phone_access} onChange={(on) => void putSettings({ phone_access: on }, on ? m.phoneOn : m.phoneOff).catch(() => {})} />;
}

/**
 * The account rows. The session and password rows exist only with a password (the registry decides); a password set in the panel
 * is changed here and may open the server to the phone, an FF_PASSWORD one is changed in .env and keeps its own network rule.
 */
export const accountRows = (withSession: boolean, password?: "env" | "app"): SettingRow[] => [
  { id: "name", name: m.name, keywords: words(m.nameKeywords), control: <OwnerName /> },
  ...(password === "app"
    ? [
      { id: "password", name: m.password, hint: m.passwordHint, keywords: words(m.passwordKeywords), control: <ChangePasswordButton /> },
      { id: "phone", name: m.phone, hint: m.phoneHint, keywords: words(m.phoneKeywords), control: <PhoneAccess /> },
    ]
    : []),
  ...(password === "env" ? [{ id: "password", name: m.password, hint: m.passwordEnvHint, keywords: words(m.passwordKeywords), control: null }] : []),
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
