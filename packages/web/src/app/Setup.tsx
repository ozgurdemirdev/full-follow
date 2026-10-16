import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { OWNER_NAME_MAX, OWNER_PASSWORD_MAX, OWNER_PASSWORD_MIN } from "../../../core/src/constants";
import { api, ApiError } from "../api/client";
import type { PriceFloor } from "../api/types";
import { FORM_ICON, PathIcon } from "../components/forms/icons";
import { setOwnerName } from "../lib/owner";
import { shell } from "../messages.shell";
import { FieldMessage, LoginSide, PasswordField } from "./Login";
import { PATHS } from "./routes";

const TEXT = shell.setup;

type Field = "name" | "password" | "confirm";

/** What is wrong with the typed values before anything is sent, or null */
function check(name: string, password: string, confirm: string, withPassword: boolean): { field: Field; text: string } | null {
  if (!name.trim()) return { field: "name", text: TEXT.nameRequired };
  if (!withPassword) return null;
  if ([...password].length < OWNER_PASSWORD_MIN) return { field: "password", text: TEXT.passwordShort(OWNER_PASSWORD_MIN) };
  if (confirm !== password) return { field: "confirm", text: TEXT.mismatch };
  return null;
}

/**
 * First run setup in the Login screen's layout. `withPassword` (no password exists yet): the name and the password twice, saved
 * together, then this browser is logged in. Without it (FF_PASSWORD is set, the name is missing): only the name. Both open the dashboard.
 */
export function Setup({ withPassword = false, onDone }: { withPassword?: boolean; onDone?: () => void }) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ field: Field; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const errorOf = (field: Field) => (error?.field === field ? error.text : "");
  const edit = (field: Field, set: (v: string) => void) => (v: string) => {
    set(v);
    if (error?.field === field) setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const wrong = check(name, password, confirm, withPassword);
    if (wrong) return setError(wrong);
    setBusy(true);
    setError(null);
    try {
      const saved = withPassword
        ? await api.post<{ owner_name: string }>("/setup", { name, password })
        : await api.put<PriceFloor>("/settings", { owner_name: name });
      navigate(PATHS.today, { replace: true });
      setOwnerName(saved.owner_name);
      onDone?.();
    } catch (err) {
      setError({ field: withPassword ? "confirm" : "name", text: err instanceof ApiError ? err.message : TEXT.failed });
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <LoginSide />
      <main className="login-main">
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="login-head">
            <span className="login-card-logo">{shell.brandMark}</span>
            <h1 className="login-title">{TEXT.title}</h1>
            <p className="login-sub">{withPassword ? TEXT.subWithPassword : TEXT.sub}</p>
          </div>
          <div className="login-fieldset">
            <label htmlFor="ff-owner" className="login-label">{TEXT.label}</label>
            <div className="login-field" data-invalid={!!errorOf("name")}>
              <PathIcon d={FORM_ICON.user} />
              <input
                id="ff-owner"
                className="login-input"
                value={name}
                onChange={(e) => edit("name", setName)(e.target.value)}
                maxLength={OWNER_NAME_MAX}
                autoComplete="given-name"
                autoFocus
                aria-invalid={!!errorOf("name")}
                aria-describedby="ff-owner-msg"
                placeholder={TEXT.placeholder}
              />
            </div>
            <FieldMessage id="ff-owner-msg" error={errorOf("name")} />
          </div>
          {withPassword ? (
            <>
              <div className="login-fieldset">
                <label htmlFor="ff-new-pass" className="login-label">{TEXT.passwordLabel}</label>
                <PasswordField id="ff-new-pass" value={password} onChange={edit("password", setPassword)} show={show} onToggle={() => setShow((s) => !s)}
                  invalid={!!errorOf("password")} describedBy="ff-new-pass-msg" autoComplete="new-password" maxLength={OWNER_PASSWORD_MAX} />
                <FieldMessage id="ff-new-pass-msg" error={errorOf("password")} note={TEXT.passwordRule(OWNER_PASSWORD_MIN)} />
              </div>
              <div className="login-fieldset">
                <label htmlFor="ff-new-pass-again" className="login-label">{TEXT.confirmLabel}</label>
                <PasswordField id="ff-new-pass-again" value={confirm} onChange={edit("confirm", setConfirm)} show={show} onToggle={() => setShow((s) => !s)}
                  invalid={!!errorOf("confirm")} describedBy="ff-new-pass-again-msg" autoComplete="new-password" maxLength={OWNER_PASSWORD_MAX} />
                <FieldMessage id="ff-new-pass-again-msg" error={errorOf("confirm")} />
              </div>
            </>
          ) : null}
          <button type="submit" className="login-go" aria-busy={busy}>
            {busy ? <span className="ff-spinner" /> : null}
            {busy ? TEXT.busy : TEXT.go}
          </button>
          <span className="login-hint">{withPassword ? TEXT.hintWithPassword : TEXT.hint}</span>
        </form>
      </main>
    </div>
  );
}
