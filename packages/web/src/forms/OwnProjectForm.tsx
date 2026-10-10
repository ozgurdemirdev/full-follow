// Own product form: what it does, status, could it be sold later, which sectors suit it
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import type { Detail, OwnProject } from "../api/types";
import { PATHS } from "../app/routes";
import { SectorPicker } from "../components/SectorPicker";
import { ChipRadio, Field } from "../components/Sheet";
import { OWN_STATUS, OWN_STATUSES, SELLABLE, SELLABLES } from "../lib/labels";
import { useSubmit, type FormProps } from "./QuickAdd";

export function OwnProjectForm(p: FormProps) {
  const editId = p.sheet.preset?.own_project_id;
  const existing = useQuery<Detail<OwnProject>>(editId ? `/own-projects/${editId}` : null);
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("aktif");
  const [sellable, setSellable] = useState("belki");
  const [sellableNote, setSellableNote] = useState("");
  const [sectors, setSectors] = useState<(number | string)[]>([]);
  const [notes, setNotes] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setDescription(row.description ?? "");
    setStatus(row.status);
    setSellable(row.sellable);
    setSellableNote(row.sellable_note ?? "");
    setSectors(row.sectors.map((s) => s.id));
    setNotes(row.notes ?? "");
  }, [row]);

  const submit = useSubmit(p, async () => {
    const data = { name: name.trim(), description, status, sellable, sellable_note: sellable === "hayir" ? "" : sellableNote, sectors, notes };
    if (editId) await run("patch", `/own-projects/${editId}`, data, { ok: "Proje kaydedildi" });
    else {
      const res = await run<OwnProject>("post", "/own-projects", data, { ok: "Proje kaydedildi" });
      if (res.row) navigate(`${PATHS.ownProjects}/${res.row.id}`);
    }
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Ad" htmlFor="op-name">
        <input id="op-name" className="inp" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Full Follow" />
      </Field>
      <Field label="Ne yapıyor" htmlFor="op-desc">
        <textarea id="op-desc" className="inp" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Durum">
        <ChipRadio label="Durum" items={OWN_STATUSES.map((s) => ({ value: s, label: OWN_STATUS[s] }))} value={status} onChange={setStatus} />
      </Field>
      <Field label="Satılabilir mi">
        <ChipRadio label="Satılabilir mi" items={SELLABLES.map((s) => ({ value: s, label: SELLABLE[s] }))} value={sellable} onChange={setSellable} />
      </Field>
      {sellable !== "hayir" ? (
        <Field label="Kime, nasıl satılabilir" htmlFor="op-sell">
          <input id="op-sell" className="inp" value={sellableNote} onChange={(e) => setSellableNote(e.target.value)} placeholder="Örn. Freelancer ve küçük ajanslara kişisel CRM" />
        </Field>
      ) : null}
      <Field label="Uygun sektörler" htmlFor="op-sector">
        <SectorPicker id="op-sector" value={sectors} onChange={setSectors} />
      </Field>
      <Field label="Notlar" htmlFor="op-notes">
        <textarea id="op-notes" className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </form>
  );
}
