import { useSyncExternalStore } from "react";
import { Link } from "wouter";
import { dismiss, getToasts, subscribeToasts } from "./toast";

/** Light pill at the bottom centre (the boards' toast); an error gets a coral dot in front */
export default function Toasts() {
  const list = useSyncExternalStore(subscribeToasts, getToasts);
  return (
    <div className="ff-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="ff-toast">
          {t.kind === "error" ? <i aria-hidden="true" /> : null}
          <span className="min-w-0">{t.text}</span>
          {t.action?.href ? (
            <Link href={t.action.href} onClick={() => dismiss(t.id)}>{t.action.label}</Link>
          ) : t.action ? (
            <button type="button" onClick={() => (dismiss(t.id), t.action?.run?.())}>{t.action.label}</button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
