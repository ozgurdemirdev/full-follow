import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";

export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/login", { password });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-page-padding-x-mobile">
      <form onSubmit={submit} className="card rise flex w-full max-w-sheet-width flex-col gap-7 p-10">
        <div className="flex items-center gap-4">
          <div className="flex size-logo items-center justify-center rounded-lg bg-accent text-base-sm font-semibold tracking-title text-accent-on">FF</div>
          <h1 className="m-0 text-xl font-semibold tracking-subtitle">Full Follow</h1>
        </div>
        <label htmlFor="pw" className="lab">Şifre</label>
        <input id="pw" type="password" className="inp" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="m-0 text-base-sm text-danger" role="alert">{error}</p> : null}
        <button type="submit" className="btn btn-pri btn-lg" disabled={busy || !password}>Giriş yap</button>
      </form>
    </main>
  );
}
