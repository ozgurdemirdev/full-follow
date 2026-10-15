import { useState } from "react";
import { run } from "@kit/api/actions";
import type { Draft } from "@kit/api/types";
import { m } from "../messages";

/** Edit, send and reject of one draft through the existing calls; every action resolves to whether it went through */
export function useDraftEdit(d: Draft, sendOk: string) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.body);
  const [subject, setSubject] = useState(d.subject ?? "");
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      return true;
    } catch {
      return false; // the notice is shown by run()
    } finally {
      setBusy(false);
    }
  };
  const changed = text !== d.body || subject.trim() !== (d.subject ?? "");
  const patch = (opts: { ok?: string; silent?: boolean }) => run("patch", `/drafts/${d.id}`, { body: text, subject }, opts);

  const save = () => act(async () => {
    if (changed) await patch({ ok: m.edit.updated });
    setEditing(false);
  });
  const send = () => act(async () => {
    if (changed) await patch({ silent: true });
    await run("post", `/drafts/${d.id}/send`, undefined, { ok: sendOk });
  });
  // an empty note is sent as an explicit "no reason", never as a made up note text
  const reject = (note: string, ok: string) => act(() => run("post", `/drafts/${d.id}/reject`, note ? { note } : { no_reason: true }, { ok }));

  return { editing, setEditing, text, setText, subject, setSubject, busy, save, send, reject };
}
