import { useMemo, useState } from "react";
import { Link } from "wouter";
import { remove, run } from "../../api/actions";
import type { Interest } from "../../api/types";
import { PATHS } from "../../app/routes";
import { emptyRef, type Ref } from "../../forms/helpers";
import { usePersonOptions } from "../../forms/shared";
import { NEXT_INTEREST } from "../../lib/ideas";
import { INTEREST } from "../../lib/labels";
import { BoardIcon } from "../boardIcons";
import { Combo } from "../Combo";
import { Avatar } from "../ui";

function PersonRow({ x }: { x: Interest }) {
  const cycle = () => run("patch", `/ideas/people/${x.id}`, { interest: NEXT_INTEREST[x.interest] }, { silent: true }).catch(() => {});
  const unlink = () => remove(`/ideas/people/${x.id}`, "Fikir bağı").catch(() => {});
  const note = [x.company_name, x.note].filter(Boolean).join(" · ");
  return (
    <div className="ideas-person">
      <Avatar name={x.person_name} id={x.person_id} size="md" />
      <span className="ideas-person-text">
        <Link href={`${PATHS.people}/${x.person_id}`}>{x.person_name}</Link>
        {note ? <span>{note}</span> : null}
      </span>
      <button type="button" className="ideas-react" data-r={x.interest} aria-label={`${x.person_name}: ${INTEREST[x.interest]}, değiştir`} onClick={cycle}>
        {INTEREST[x.interest]}
      </button>
      <button type="button" className="ideas-unlink" aria-label={`${x.person_name} bağını kaldır`} onClick={unlink}>
        <BoardIcon name="close" className="size-icon-sm" stroke={2} />
      </button>
    </div>
  );
}

/** Pick a person from the list and link them to the idea (as told, no answer yet) */
function AddPerson({ ideaId }: { ideaId: number }) {
  const options = usePersonOptions();
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!person.id || busy) return;
    setBusy(true);
    try {
      await run("post", `/ideas/${ideaId}/people`, { person_id: person.id, interest: "anlatildi" }, { ok: `${person.text} fikre bağlandı` });
      setPerson(emptyRef);
    } catch {
      /* the notice is shown by run() */
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="ideas-add">
      <span className="sr-only">Kişi bağla</span>
      <Combo value={person} onChange={setPerson} options={options} placeholder="Kime anlattın? İsim yaz" allowNew={false} />
      <button type="button" className="ideas-add-go" aria-label="Bağla" disabled={busy || !person.id} onClick={() => void add()}>
        <BoardIcon name="plus" className="size-icon-chip" stroke={2.4} />
      </button>
    </label>
  );
}

/** Right panel "Kime anlatıldı": the people told with their reaction (tap to cycle) and the field to add one; people is undefined while loading */
export function IdeaPeople({ ideaId, people }: { ideaId: number; people?: Interest[] }) {
  // the API lists the last changed link first; rows keep their place while a reaction is cycled
  const rows = useMemo(() => people && [...people].sort((a, b) => a.id - b.id), [people]);
  return (
    <section aria-label="Kime anlatıldı" className="ideas-people">
      <div className="ideas-people-head">
        <h2>Kime anlatıldı</h2>
        <span>tepkiye dokun, değişsin</span>
      </div>
      {rows?.map((x) => <PersonRow key={x.id} x={x} />)}
      {rows && !rows.length ? <p className="ideas-none">Henüz kimseye anlatılmadı.</p> : null}
      <AddPerson ideaId={ideaId} />
      <span className="ideas-foot">Temas eklerken fikri seçersen kişi buraya kendiliğinden düşer.</span>
    </section>
  );
}
