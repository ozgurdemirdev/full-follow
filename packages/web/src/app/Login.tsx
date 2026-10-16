import { useState, type FormEvent } from "react";
import { api, ApiError, HTTP_UNAUTHORIZED } from "../api/client";
import { FORM_ICON, PathIcon } from "../components/forms/icons";
import { shell } from "../messages.shell";
import { stroke as STROKE } from "../styles/tokens.json";

const TEXT = shell.login;

/** The brand panel of the login board (desktop only), shared with the first run setup. It carries no business numbers: nothing is fetched before the session exists. */
export function LoginSide() {
  return (
    <aside className="login-side" aria-hidden="true">
      <span className="login-orb" data-tone="accent" />
      <span className="login-orb" data-tone="claude" />
      <div className="login-brand">
        <span className="login-logo">{shell.brandMark}</span>
        <span className="login-brandname">{shell.brand}</span>
      </div>
      <div className="login-pitch">
        <span className="login-headline">{TEXT.headlineTop}<br />{TEXT.headlineBottom}</span>
        <span className="login-lead">{TEXT.lead}</span>
      </div>
      <span />
    </aside>
  );
}

/** The password field of the login board: lock icon, the input, the eye that shows or hides it (shared with the first run setup) */
export function PasswordField({ id, value, onChange, show, onToggle, invalid, describedBy, autoComplete, autoFocus, maxLength }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  invalid: boolean;
  describedBy: string;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="login-field" data-invalid={invalid}>
      <PathIcon d={FORM_ICON.lock} />
      <input
        id={id}
        className="login-input"
        type={show ? "text" : "password"}
        data-masked={!show && !!value}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={TEXT.mask}
      />
      <button type="button" className="login-eye" aria-label={show ? TEXT.hide : TEXT.show} aria-pressed={show} onClick={onToggle}>
        <PathIcon d={show ? FORM_ICON.eyeOff : FORM_ICON.eye} className="size-icon-lg" />
      </button>
    </div>
  );
}

/** The message line under a login board field: an error with its icon (an alert), or a quiet note */
export function FieldMessage({ id, error, note }: { id: string; error: string; note?: string }) {
  return (
    <span id={id} className="login-msg" role={error ? "alert" : "status"}>
      {error ? <PathIcon d={FORM_ICON.alert} className="size-icon-xs" stroke={STROKE.regular} /> : null}
      {error || note}
    </span>
  );
}

/** Login from the design board */
export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/login", { password });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === HTTP_UNAUTHORIZED ? TEXT.wrong : err.message) : TEXT.failed);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <LoginSide />
      <main className="login-main">
        <form className="login-card" onSubmit={submit}>
          <div className="login-head">
            <span className="login-card-logo">{shell.brandMark}</span>
            <h1 className="login-title">{TEXT.title}</h1>
            <p className="login-sub">{TEXT.sub}</p>
          </div>
          <div className="login-fieldset">
            <label htmlFor="ff-pass" className="login-label">{TEXT.label}</label>
            <PasswordField
              id="ff-pass"
              value={password}
              onChange={(v) => {
                setPassword(v);
                setError("");
              }}
              show={show}
              onToggle={() => setShow((s) => !s)}
              invalid={!!error}
              describedBy="ff-pass-msg"
              autoComplete="current-password"
              autoFocus
            />
            <FieldMessage id="ff-pass-msg" error={error} />
          </div>
          <button type="submit" className="login-go" aria-busy={busy}>
            {busy ? <span className="ff-spinner" /> : null}
            {busy ? TEXT.busy : TEXT.go}
          </button>
          <span className="login-hint">{TEXT.hint}</span>
        </form>
      </main>
    </div>
  );
}
