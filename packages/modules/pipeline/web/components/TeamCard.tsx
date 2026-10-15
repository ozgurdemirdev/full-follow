import { useState } from "react";
import { remove, run } from "@kit/api/actions";
import { usePeople } from "@kit/api/keys";
import type { OppPerson, Opportunity } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { emptyRef, type Ref } from "@kit/forms/helpers";
import { OPP_ROLE, OPP_ROLES } from "../labels";
import { Combo } from "@kit/components/Combo";
import { Avatar, Card, Chip } from "@kit/components/ui";

/** The people on an opportunity: the main contact first, then the team with a role each */
export function TeamCard({ opp, team }: { opp: Opportunity; team: OppPerson[] }) {
  const people = usePeople();
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [role, setRole] = useState("diger");
  const [note, setNote] = useState("");
  const options = people.rows
    .filter((p) => p.id !== opp.person_id && !team.some((t) => t.person_id === p.id))
    .map((p) => ({ id: p.id, label: p.name, sub: p.company_name ?? undefined }));
  const add = async () => {
    if (!person.id) return;
    try {
      await run("post", "/opportunity-people", { opportunity_id: opp.id, person_id: person.id, role, note: note.trim() || null });
      setPerson(emptyRef);
      setNote("");
    } catch {
      /* bildirim run() içinde */
    }
  };
  return (
    <Card title="Ekip" className="opp-side rise">
      <div className="flex items-center gap-4">
        <Avatar name={opp.person_name} />
        <RecordLink type="person" id={opp.person_id} className="min-w-0 flex-grow truncate text-base">{opp.person_name}</RecordLink>
        <Chip tone="success">Ana muhatap</Chip>
      </div>
      {team.map((t) => (
        <div key={t.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={t.person_name} />
            <div className="flex min-w-0 flex-grow flex-col">
              <RecordLink type="person" id={t.person_id} className="truncate text-base">{t.person_name}</RecordLink>
              {t.company_name ? <span className="truncate text-sm text-text-secondary">{t.company_name}</span> : null}
            </div>
            <select className="inp h-control-height-sm w-auto" aria-label={`${t.person_name} rolü`} value={t.role}
              onChange={(e) => void run("patch", `/opportunity-people/${t.id}`, { role: e.target.value }).catch(() => {})}>
              {OPP_ROLES.map((r) => <option key={r} value={r}>{OPP_ROLE[r]}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(`/opportunity-people/${t.id}`, t.person_name).catch(() => {})}>Çıkar</button>
          </div>
          {t.note ? <p className="m-0 text-base-sm text-text-secondary">{t.note}</p> : null}
        </div>
      ))}
      <div className="flex flex-col gap-3">
        <Combo id="team-person" value={person} onChange={setPerson} options={options} placeholder="Kişi ara ve ekle" allowNew={false} />
        <div className="flex flex-wrap gap-3">
          <select className="inp w-auto" aria-label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
            {OPP_ROLES.map((r) => <option key={r} value={r}>{OPP_ROLE[r]}</option>)}
          </select>
          <input className="inp min-w-0 flex-1" placeholder="Not (isteğe bağlı)" aria-label="Not" value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void add())} />
          <button type="button" className="btn btn-sec" disabled={!person.id} onClick={() => void add()}>Ekle</button>
        </div>
      </div>
    </Card>
  );
}
