import { useState, type ReactNode } from "react";
import { remove, run } from "../../api/actions";
import { useSectors, useSources, useTags } from "../../api/keys";
import { SetChip } from "../../components/settings/Parts";
import { ErrorBox } from "../../components/ui";
import { TAG_CLS, TAG_COLORS, TONE_CLS } from "../../lib/labels";
import { words, type SettingRow } from "../../lib/settings";
import { m as kit } from "../../messages";
import { settings } from "../../messages.settings";

const m = settings.lists;
const COLOR_NAME: Record<string, string> = settings.colors;
const { tags: tg, sectors: sc, sources: so } = settings;

/** The dot takes its colour from the text colour class of the tag */
const dotClass = (color: string) => (TAG_CLS[color] ?? TONE_CLS.neutral).split(" ").find((c) => c.startsWith("text-")) ?? "";

const usage = (people: number, companies = 0, extra = "") =>
  [people ? m.people(people) : "", companies ? m.companies(companies) : "", extra].filter(Boolean).join(settings.today.dot) || m.unused;

/** Type a name and press Enter to add */
function AddForm({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd(name.trim());
      setName("");
    } catch {
      /* the toast is shown inside run() */
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="set-add" onSubmit={(e) => (e.preventDefault(), void add())}>
      <input className="set-input" placeholder={placeholder} aria-label={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="set-btn" disabled={busy || !name.trim()}>{kit.add}</button>
    </form>
  );
}

/** Rename in place: a click turns the name into a field, Enter or leaving saves, Escape cancels */
function Rename({ value, onSave }: { value: string; onSave: (v: string) => Promise<unknown> }) {
  const [v, setV] = useState<string | null>(null);
  if (v === null) return <button type="button" className="set-chip-name" title={m.rename} onClick={() => setV(value)}>{value}</button>;
  const done = () => {
    const n = v.trim();
    setV(null);
    if (n && n !== value) void onSave(n).catch(() => {});
  };
  return (
    <input className="set-chip-input" aria-label={m.newName} value={v} autoFocus onChange={(e) => setV(e.target.value)} onBlur={done}
      onKeyDown={(e) => (e.key === "Enter" ? done() : e.key === "Escape" ? setV(null) : undefined)} />
  );
}

/** Chip list with the add field under it; shows the load error instead when the list failed */
function ListEditor({ error, retry, loaded, children, add }: { error?: Error; retry: () => void; loaded: boolean; children: ReactNode; add: ReactNode }) {
  return (
    <div className="set-list">
      {error && !loaded ? <ErrorBox error={error} retry={retry} /> : null}
      <span className="set-chips">{children}</span>
      {add}
    </div>
  );
}

function Tags() {
  const tags = useTags();
  return (
    <ListEditor error={tags.error} retry={tags.reload} loaded={!!tags.data} add={<AddForm placeholder={tg.placeholder} onAdd={(name) => run("post", "/tags", { name }, { ok: tg.added })} />}>
      {tags.rows.filter((t) => !t.deleted_at).map((t) => (
        <SetChip
          key={t.id}
          title={usage(t.people_count, t.company_count)}
          removeLabel={m.remove(t.name)}
          remove={() => void remove(`/tags/${t.id}`, tg.named(t.name)).catch(() => {})}
          dot={(
            <label className="set-dot-pick" title={tg.colorTitle}>
              <i className={`set-dot ${dotClass(t.color)}`} />
              <select aria-label={tg.colorOf(t.name)} value={t.color} onChange={(e) => void run("patch", `/tags/${t.id}`, { color: e.target.value }).catch(() => {})}>
                {TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_NAME[c] ?? c}</option>)}
              </select>
            </label>
          )}
        >
          <Rename value={t.name} onSave={(name) => run("patch", `/tags/${t.id}`, { name }, { ok: tg.updated })} />
        </SetChip>
      ))}
    </ListEditor>
  );
}

function Sectors() {
  const sectors = useSectors();
  return (
    <ListEditor error={sectors.error} retry={sectors.reload} loaded={!!sectors.data} add={<AddForm placeholder={sc.placeholder} onAdd={(name) => run("post", "/sectors", { name }, { ok: sc.added })} />}>
      {sectors.rows.filter((s) => !s.deleted_at).map((s) => (
        <SetChip
          key={s.id}
          title={usage(s.people_count, s.company_count)}
          removeLabel={m.remove(s.name)}
          remove={() => void remove(`/sectors/${s.id}`, sc.named(s.name)).catch(() => {})}
          dot={<i className="set-dot set-dot-neutral" />}
        >
          {s.parent_name ? <span className="set-chip-parent">{s.parent_name} ›</span> : null}
          <Rename value={s.name} onSave={(name) => run("patch", `/sectors/${s.id}`, { name }, { ok: sc.updated })} />
        </SetChip>
      ))}
    </ListEditor>
  );
}

function Sources() {
  const sources = useSources();
  return (
    <ListEditor error={sources.error} retry={sources.reload} loaded={!!sources.data} add={<AddForm placeholder={so.placeholder} onAdd={(name) => run("post", "/sources", { name, kind: "diger" }, { ok: so.added })} />}>
      {sources.rows.filter((x) => !x.deleted_at).map((x) => (
        <SetChip
          key={x.id}
          title={usage(x.people_count, x.company_count, x.opp_count ? m.opportunities(x.opp_count) : "")}
          removeLabel={m.remove(x.name)}
          remove={() => void remove(`/sources/${x.id}`, so.named(x.name)).catch(() => {})}
          dot={<i className="set-dot set-dot-source" />}
        >
          <Rename value={x.name} onSave={(name) => run("patch", `/sources/${x.id}`, { name }, { ok: so.updated })} />
        </SetChip>
      ))}
    </ListEditor>
  );
}

export const listRows = (): SettingRow[] => [
  { id: "tags", name: tg.name, hint: tg.hint, keywords: words(tg.keywords), wide: true, control: <Tags /> },
  { id: "sectors", name: sc.name, hint: sc.hint, keywords: words(sc.keywords), wide: true, control: <Sectors /> },
  { id: "sources", name: so.name, hint: so.hint, keywords: words(so.keywords), wide: true, control: <Sources /> },
];
