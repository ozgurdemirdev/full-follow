import { useState } from "react";
import { Link } from "wouter";
import type { RefSuggestion } from "../../api/types";
import { PATHS } from "../../app/routes";
import { requestDraft, type RequestKind } from "../../lib/referrals";
import { Avatar, order } from "../ui";

const LABEL: Record<RequestKind, string> = { thanks: "Claude teşekkür yazsın", ask: "Claude rica yazsın" };
const DONE: Record<RefSuggestion["state"], string> = { idle: "", asked: "Taslak istendi", drafted: "Taslak hazır" };

function Row({ kind, s }: { kind: RequestKind; s: RefSuggestion }) {
  const [busy, setBusy] = useState(false);
  const done = s.state !== "idle";
  const send = async () => {
    if (busy || done) return;
    setBusy(true);
    try {
      await requestDraft(kind, s.person);
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="ref-sug" data-dim={s.ready ? undefined : ""}>
      <Avatar name={s.person.name} id={s.person.id} size="list" />
      <Link href={`${PATHS.people}/${s.person.id}`} className="ref-sug-who">
        <b>{s.person.name}</b>
        <span data-late={s.ready ? undefined : ""}>{s.why}</span>
      </Link>
      {s.ready ? (
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
      <List kind="thanks" title="Teşekkür zamanı" empty="Son günlerde referansla kazanılan iş yok." rows={thanks} />
      <List kind="ask" title="Kimden referans istenir" empty="Şu an referans istenecek kimse yok." rows={asks} />
    </div>
  );
}
