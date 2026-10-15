import { useMemo, useState } from "react";
import { remove, run } from "@kit/api/actions";
import type { Interest } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { emptyRef, type Ref } from "@kit/forms/helpers";
import { PERSON_REMOTE } from "@kit/forms/shared";
import { NEXT_INTEREST } from "../ideas";
import { INTEREST } from "../labels";
import { m } from "../messages";
import { BoardIcon } from "@kit/components/boardIcons";
import { Combo } from "@kit/components/Combo";
import { Avatar } from "@kit/components/ui";
import { stroke as STROKE } from "@kit/styles/tokens.json";

function PersonRow({ x }: { x: Interest }) {
  const cycle = () => run("patch", `/ideas/people/${x.id}`, { interest: NEXT_INTEREST[x.interest] }, { silent: true }).catch(() => {});
  const unlink = () => remove(`/ideas/people/${x.id}`, m.people.linkNoun).catch(() => {});
  const note = [x.company_name, x.note].filter(Boolean).join(" · ");
  return (
    <div className="ideas-person">
      <Avatar name={x.person_name} id={x.person_id} size="md" />
      <span className="ideas-person-text">
        <RecordLink type="person" id={x.person_id}>{x.person_name}</RecordLink>
        {note ? <span>{note}</span> : null}
      </span>
      <button type="button" className="ideas-react" data-r={x.interest} aria-label={m.people.cycleLabel(x.person_name, INTEREST[x.interest])} onClick={cycle}>
        {INTEREST[x.interest]}
      </button>
      <button type="button" className="ideas-unlink" aria-label={m.people.unlinkLabel(x.person_name)} onClick={unlink}>
        <BoardIcon name="close" className="size-icon-sm" stroke={STROKE.regular} />
      </button>
    </div>
  );
}

/** Pick a person from the list and link them to the idea (as told, no answer yet) */
function AddPerson({ ideaId }: { ideaId: number }) {
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!person.id || busy) return;
    setBusy(true);
    try {
      await run("post", `/ideas/${ideaId}/people`, { person_id: person.id, interest: "anlatildi" }, { ok: m.people.linked(person.text) });
      setPerson(emptyRef);
    } catch {
      /* the notice is shown by run() */
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="ideas-add">
      <span className="sr-only">{m.people.link}</span>
      <Combo value={person} onChange={setPerson} remote={PERSON_REMOTE} placeholder={m.people.placeholder} allowNew={false} />
      <button type="button" className="ideas-add-go" aria-label={m.people.linkButton} disabled={busy || !person.id} onClick={() => void add()}>
        <BoardIcon name="plus" className="size-icon-chip" stroke={STROKE.bold} />
      </button>
    </label>
  );
}

/** Right panel "Kime anlatıldı": the people told with their reaction (tap to cycle) and the field to add one; people is undefined while loading */
export function IdeaPeople({ ideaId, people }: { ideaId: number; people?: Interest[] }) {
  // the API lists the last changed link first; rows keep their place while a reaction is cycled
  const rows = useMemo(() => people && [...people].sort((a, b) => a.id - b.id), [people]);
  return (
    <section aria-label={m.people.title} className="ideas-people">
      <div className="ideas-people-head">
        <h2>{m.people.title}</h2>
        <span>{m.people.cycleHint}</span>
      </div>
      {rows?.map((x) => <PersonRow key={x.id} x={x} />)}
      {rows && !rows.length ? <p className="ideas-none">{m.people.none}</p> : null}
      <AddPerson ideaId={ideaId} />
      <span className="ideas-foot">{m.people.foot}</span>
    </section>
  );
}
