import { useState } from "react";
import { run } from "../../api/actions";
import type { Draft } from "../../api/types";

/** Edit, send and reject of one draft through the existing calls; every action resolves to whether it went through */
export function useDraftEdit(d: Draft, sendOk: string) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.body);
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
  const patch = (opts: { ok?: string; silent?: boolean }) => run("patch", `/drafts/${d.id}`, { body: text }, opts);

  const save = () => act(async () => {
    if (text !== d.body) await patch({ ok: "Taslak güncellendi" });
    setEditing(false);
  });
  const send = () => act(async () => {
    if (text !== d.body) await patch({ silent: true });
    await run("post", `/drafts/${d.id}/send`, undefined, { ok: sendOk });
  });
  const reject = (note: string, ok: string) => act(() => run("post", `/drafts/${d.id}/reject`, { note }, { ok }));

  return { editing, setEditing, text, setText, busy, save, send, reject };
}
