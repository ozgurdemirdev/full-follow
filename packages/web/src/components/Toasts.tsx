import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useSyncExternalStore } from "react";
import { Link } from "wouter";
import { dur, ease, riseY } from "../lib/motion";
import { MotionScope } from "./MotionScope";
import { dismiss, getToasts, subscribeToasts } from "./toast";

export default function Toasts() {
  const list = useSyncExternalStore(subscribeToasts, getToasts);
  return (
    <MotionScope>
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-toast flex flex-col items-center gap-3 px-7" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <m.div
            key={t.id}
            initial={{ opacity: 0, y: riseY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: riseY / 2 }}
            transition={{ duration: dur.sidebar, ease: ease.out }}
            className={`pointer-events-auto flex max-w-content-narrow items-center gap-5 rounded-xl border bg-surface-menu px-7 py-4 text-base-sm shadow-menu ${
              t.kind === "error" ? "border-chip-warning-bg text-status-text-danger" : "border-border-menu text-text-primary"
            }`}
          >
            <span className="min-w-0 flex-grow">{t.text}</span>
            {t.action?.href ? (
              <Link href={t.action.href} onClick={() => dismiss(t.id)} className="flex-none font-medium text-primary-text">{t.action.label}</Link>
            ) : t.action ? (
              <button type="button" className="flex-none border-0 bg-transparent p-0 font-medium text-primary-text" onClick={() => (dismiss(t.id), t.action?.run?.())}>
                {t.action.label}
              </button>
            ) : null}
          </m.div>
        ))}
      </AnimatePresence>
    </div>
    </MotionScope>
  );
}
