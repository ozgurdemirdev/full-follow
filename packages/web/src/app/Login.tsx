import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import { FORM_ICON, PathIcon } from "../components/forms/icons";
import { shell } from "../messages.shell";
import { stroke as STROKE } from "../styles/tokens.json";

const HTTP_UNAUTHORIZED = 401;
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
            <div className="login-field" data-invalid={!!error}>
              <PathIcon d={FORM_ICON.lock} />
              <input
                id="ff-pass"
                className="login-input"
                type={show ? "text" : "password"}
                data-masked={!show && !!password}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                autoComplete="current-password"
                autoFocus
                aria-invalid={!!error}
                aria-describedby="ff-pass-msg"
                placeholder="••••••••"
              />
              <button type="button" className="login-eye" aria-label={show ? TEXT.hide : TEXT.show} aria-pressed={show} onClick={() => setShow((s) => !s)}>
                <PathIcon d={show ? FORM_ICON.eyeOff : FORM_ICON.eye} className="size-icon-lg" />
              </button>
            </div>
            <span id="ff-pass-msg" className="login-msg" role={error ? "alert" : "status"}>
              {error ? <PathIcon d={FORM_ICON.alert} className="size-icon-xs" stroke={STROKE.regular} /> : null}
              {error}
            </span>
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
