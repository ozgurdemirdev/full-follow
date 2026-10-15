import { useSyncExternalStore } from "react";
import { Link } from "wouter";
import { BoardIcon } from "./boardIcons";
import { dismiss, getToasts, subscribeToasts } from "./toast";
import { stroke as STROKE } from "../styles/tokens.json";

/** Light pill at the bottom centre (the boards' toast): a saved record gets the check mark, an error a coral dot in front, an action the dark pill after */
export default function Toasts() {
  const list = useSyncExternalStore(subscribeToasts, getToasts);
  return (
    <div className="ff-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="ff-toast" data-action={t.action ? "" : undefined}>
          {t.kind === "error" ? <i aria-hidden="true" /> : null}
          {t.kind === "saved" ? (
            <span className="ff-toast-check"><BoardIcon name="check" className="size-icon-sm" stroke={STROKE.black} /></span>
          ) : null}
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
