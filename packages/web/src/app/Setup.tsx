import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { OWNER_NAME_MAX } from "../../../core/src/constants";
import { api, ApiError } from "../api/client";
import type { PriceFloor } from "../api/types";
import { FORM_ICON, PathIcon } from "../components/forms/icons";
import { setOwnerName } from "../lib/owner";
import { shell } from "../messages.shell";
import { stroke as STROKE } from "../styles/tokens.json";
import { LoginSide } from "./Login";
import { PATHS } from "./routes";

const TEXT = shell.setup;

/** First run setup: one question, the owner's name, in the Login screen's layout. Saving opens the dashboard. */
export function Setup() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const saved = await api.put<PriceFloor>("/settings", { owner_name: name });
      navigate(PATHS.today, { replace: true });
      setOwnerName(saved.owner_name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : TEXT.failed);
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
            <label htmlFor="ff-owner" className="login-label">{TEXT.label}</label>
            <div className="login-field" data-invalid={!!error}>
              <PathIcon d={FORM_ICON.user} />
              <input
                id="ff-owner"
                className="login-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                maxLength={OWNER_NAME_MAX}
                autoComplete="given-name"
                autoFocus
                aria-invalid={!!error}
                aria-describedby="ff-owner-msg"
                placeholder={TEXT.placeholder}
              />
            </div>
            <span id="ff-owner-msg" className="login-msg" role={error ? "alert" : "status"}>
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
