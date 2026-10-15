// Tag, sector, source and status fields shared by the person and company forms (the labels every contact carries)
import { useEffect, useMemo, useState } from "react";
import { run } from "../api/actions";
import { pickable, useSectors, useSources, useTags } from "../api/keys";
import type { Labeled, Tag } from "../api/types";
import { ChipsField } from "../components/forms/fields";
import { TagsField, type TagItem } from "../components/forms/fields-rich";
import { norm } from "../lib/format";
import { CONTACT_STATUS, CONTACT_STATUSES } from "../lib/labels";
import { forms } from "../messages.forms";

const m = forms.pickers;
const SUGGESTIONS = 4;

/** Tags by id: typed text picks an existing tag or opens a new one */
export function TagIdsField({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const tags = useTags();
  const live = useMemo(() => pickable(tags.rows, value), [tags.rows, value]);
  const items = useMemo(() => value.map((id): TagItem => ({ key: id, label: tags.byId.get(id)?.name ?? String(id) })), [value, tags.byId]);
  const suggestions = useMemo(() => live.filter((t) => !value.includes(t.id)).slice(0, SUGGESTIONS).map((t) => t.name), [live, value]);
  const add = async (text: string) => {
    const hit = tags.rows.find((t) => norm(t.name) === norm(text) && !t.deleted_at);
    if (hit) return void (value.includes(hit.id) || onChange([...value, hit.id]));
    const r = await run<Tag>("post", "/tags", { name: text }).catch(() => null);
    if (r?.row) onChange([...value, r.row.id]);
  };
  return (
    <TagsField label={m.tags} tags={items} suggestions={suggestions} placeholder={m.tagPlaceholder} onAdd={(t) => void add(t)} onRemove={(k) => onChange(value.filter((id) => id !== k))} />
  );
}

/**
 * Sectors as tags: a number is an existing sector, a text ("Ana > Alt") is sent as typed and core opens it.
 * A sub-sector stands in for its parent, so choosing one drops the parent from the value.
 */
export function SectorTagsField({ value, onChange, label = m.sectors }: { value: (number | string)[]; onChange: (v: (number | string)[]) => void; label?: string }) {
  const sectors = useSectors();
  const ids = useMemo(() => value.filter((v): v is number => typeof v === "number"), [value]);
  const live = useMemo(() => pickable(sectors.rows, ids), [sectors.rows, ids]);
  const items = useMemo(() => value.map((v): TagItem => ({ key: v, label: typeof v === "number" ? (sectors.byId.get(v)?.path ?? String(v)) : v })), [value, sectors.byId]);
  const suggestions = useMemo(() => live.filter((s) => !ids.includes(s.id)).slice(0, SUGGESTIONS).map((s) => s.path), [live, ids]);
  const add = (text: string) => {
    const hit = live.find((s) => norm(s.path) === norm(text) || norm(s.name) === norm(text));
    if (hit) return onChange(ids.includes(hit.id) ? value : [...value.filter((v) => v !== hit.parent_id), hit.id]);
    if (!value.some((v) => typeof v === "string" && norm(v) === norm(text))) onChange([...value, text]);
  };
  return <TagsField label={label} tags={items} suggestions={suggestions} placeholder={m.sectorPlaceholder} onAdd={add} onRemove={(k) => onChange(value.filter((v) => v !== k))} />;
}

/** Where it was found: one source of the list, unpicked with a second press */
export function SourceField({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const sources = useSources();
  const list = pickable(sources.rows, value ? [value] : []);
  return (
    <ChipsField
      label={m.source}
      clearable
      value={value ? String(value) : ""}
      onChange={(v) => onChange(v ? Number(v) : null)}
      options={list.map((s) => ({ value: String(s.id), label: s.name }))}
    />
  );
}

export function StatusField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ChipsField
      label={m.status}
      hint={m.statusHint}
      value={value}
      onChange={(v) => v && onChange(v)}
      options={CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS[s] }))}
    />
  );
}

/** Labels of a person or a company: tags, sectors, source and contact status; `body` is what goes into the save */
export function useLabels(row: Labeled | undefined, defaults: { tags?: number[] } = {}) {
  const [tags, setTags] = useState<number[]>(defaults.tags ?? []);
  const [sectors, setSectors] = useState<(number | string)[]>([]);
  const [source, setSource] = useState<number | null>(null);
  const [status, setStatus] = useState("yazilmadi");
  useEffect(() => {
    if (!row) return;
    setTags(row.tag_ids);
    setSectors(row.sectors.map((s) => s.id));
    setSource(row.source_id);
    setStatus(row.contact_status);
  }, [row]);
  return {
    body: { tags, sectors, source_id: source, contact_status: status },
    tagsField: <TagIdsField value={tags} onChange={setTags} />,
    sectorsField: <SectorTagsField value={sectors} onChange={setSectors} />,
    sourceField: <SourceField value={source} onChange={setSource} />,
    statusField: <StatusField value={status} onChange={setStatus} />,
  };
}
