import { useState } from "react";
import type { RefSuggestion } from "../types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { useTasksOn } from "@kit/lib/taskAccess";
import { requestDraft, type RequestKind } from "../referrals";
import { Avatar, order } from "@kit/components/ui";
import { m } from "../messages";

const LABEL: Record<RequestKind, string> = { thanks: m.suggestions.thanksButton, ask: m.suggestions.askButton };
const DONE: Record<RefSuggestion["state"], string> = { idle: "", asked: m.suggestions.asked, drafted: m.suggestions.drafted };

function Row({ kind, s }: { kind: RequestKind; s: RefSuggestion }) {
  const [busy, setBusy] = useState(false);
  const tasksOn = useTasksOn();
  const done = s.state !== "idle";
  const send = async () => {
    if (busy || done) return;
    setBusy(true);
    try {
      await requestDraft(kind, s);
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="ref-sug" data-dim={s.ready ? undefined : ""}>
      <Avatar name={s.person.name} id={s.person.id} size="list" />
      <RecordLink type="person" id={s.person.id} className="ref-sug-who">
        <b>{s.person.name}</b>
        <span data-late={s.ready ? undefined : ""}>{s.why}</span>
      </RecordLink>
      {s.ready && tasksOn ? (
        <button type="button" className="ref-act" data-claude={kind === "thanks" && !done ? "" : undefined} data-done={done || busy ? "" : undefined} disabled={busy && !done} onClick={() => void send()}>
          {done ? DONE[s.state] : busy ? DONE.asked : LABEL[kind]}
        </button>
      ) : null}
    </div>
  );
}

function List({ kind, title, empty, rows }: { kind: RequestKind; title: string; empty: string; rows: RefSuggestion[] }) {
  return (
    <section className="ref-list" aria-label={title}>
      <h2>{title}</h2>
      {rows.map((s) => <Row key={s.person.id} kind={kind} s={s} />)}
      {rows.length === 0 ? <p className="ref-none">{empty}</p> : null}
    </section>
  );
}

/** "Teşekkür zamanı" and "Kimden referans istenir": each row asks Claude for a draft */
export function Suggestions({ thanks, asks }: { thanks: RefSuggestion[]; asks: RefSuggestion[] }) {
  return (
    <div className="ref-asks rise" style={order(3)}>
      <List kind="thanks" title={m.suggestions.thanksTitle} empty={m.suggestions.thanksEmpty} rows={thanks} />
      <List kind="ask" title={m.suggestions.asksTitle} empty={m.suggestions.asksEmpty} rows={asks} />
    </div>
  );
}
