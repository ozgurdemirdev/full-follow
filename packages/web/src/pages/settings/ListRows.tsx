import { useState, type ReactNode } from "react";
import { remove, run } from "../../api/actions";
import { useSectors, useSources, useTags } from "../../api/keys";
import { SetChip } from "../../components/settings/Parts";
import { ErrorBox } from "../../components/ui";
import { TAG_CLS, TAG_COLORS, TONE_CLS } from "../../lib/labels";
import type { SettingRow } from "../../lib/settings";

const COLOR_NAME: Record<string, string> = {
  aday: "Gri", musteri: "Yeşil", ajans: "Mavi", is_ortagi: "Mor", network: "Kum",
  opportunity: "Açık mavi", source: "Pembe", payment: "Sarı", warning: "Kırmızı", success: "Açık yeşil",
};

/** The dot takes its colour from the text colour class of the tag */
const dotClass = (color: string) => (TAG_CLS[color] ?? TONE_CLS.neutral).split(" ").find((c) => c.startsWith("text-")) ?? "";

const usage = (people: number, companies = 0, extra = "") =>
  [people ? `${people} kişi` : "", companies ? `${companies} firma` : "", extra].filter(Boolean).join(" · ") || "kullanılmıyor";

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
      <button type="submit" className="set-btn" disabled={busy || !name.trim()}>Ekle</button>
    </form>
  );
}

/** Rename in place: a click turns the name into a field, Enter or leaving saves, Escape cancels */
function Rename({ value, onSave }: { value: string; onSave: (v: string) => Promise<unknown> }) {
  const [v, setV] = useState<string | null>(null);
  if (v === null) return <button type="button" className="set-chip-name" title="Adı değiştir" onClick={() => setV(value)}>{value}</button>;
  const done = () => {
    const n = v.trim();
    setV(null);
    if (n && n !== value) void onSave(n).catch(() => {});
  };
  return (
    <input className="set-chip-input" aria-label="Yeni ad" value={v} autoFocus onChange={(e) => setV(e.target.value)} onBlur={done}
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
    <ListEditor error={tags.error} retry={tags.reload} loaded={!!tags.data} add={<AddForm placeholder="Yeni etiket adı" onAdd={(name) => run("post", "/tags", { name }, { ok: "Etiket eklendi" })} />}>
      {tags.rows.filter((t) => !t.deleted_at).map((t) => (
        <SetChip
          key={t.id}
          title={usage(t.people_count, t.company_count)}
          removeLabel={`${t.name} sil`}
          remove={() => void remove(`/tags/${t.id}`, `“${t.name}” etiketi`).catch(() => {})}
          dot={(
            <label className="set-dot-pick" title="Rengi değiştir">
              <i className={`set-dot ${dotClass(t.color)}`} />
              <select aria-label={`${t.name} rengi`} value={t.color} onChange={(e) => void run("patch", `/tags/${t.id}`, { color: e.target.value }).catch(() => {})}>
                {TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_NAME[c] ?? c}</option>)}
              </select>
            </label>
          )}
        >
          <Rename value={t.name} onSave={(name) => run("patch", `/tags/${t.id}`, { name }, { ok: "Etiket güncellendi" })} />
        </SetChip>
      ))}
    </ListEditor>
  );
}

function Sectors() {
  const sectors = useSectors();
  return (
    <ListEditor error={sectors.error} retry={sectors.reload} loaded={!!sectors.data} add={<AddForm placeholder="Sağlık ya da Sağlık > Diş hekimi" onAdd={(name) => run("post", "/sectors", { name }, { ok: "Sektör eklendi" })} />}>
      {sectors.rows.filter((s) => !s.deleted_at).map((s) => (
        <SetChip
          key={s.id}
          title={usage(s.people_count, s.company_count)}
          removeLabel={`${s.name} sil`}
          remove={() => void remove(`/sectors/${s.id}`, `“${s.name}” sektörü`).catch(() => {})}
          dot={<i className="set-dot set-dot-neutral" />}
        >
          {s.parent_name ? <span className="set-chip-parent">{s.parent_name} ›</span> : null}
          <Rename value={s.name} onSave={(name) => run("patch", `/sectors/${s.id}`, { name }, { ok: "Sektör güncellendi" })} />
        </SetChip>
      ))}
    </ListEditor>
  );
}

function Sources() {
  const sources = useSources();
  return (
    <ListEditor error={sources.error} retry={sources.reload} loaded={!!sources.data} add={<AddForm placeholder="Yeni kaynak adı" onAdd={(name) => run("post", "/sources", { name, kind: "diger" }, { ok: "Kaynak eklendi" })} />}>
      {sources.rows.filter((x) => !x.deleted_at).map((x) => (
        <SetChip
          key={x.id}
          title={usage(x.people_count, x.company_count, x.opp_count ? `${x.opp_count} fırsat` : "")}
          removeLabel={`${x.name} sil`}
          remove={() => void remove(`/sources/${x.id}`, `“${x.name}” kaynağı`).catch(() => {})}
          dot={<i className="set-dot set-dot-source" />}
        >
          <Rename value={x.name} onSave={(name) => run("patch", `/sources/${x.id}`, { name }, { ok: "Kaynak güncellendi" })} />
        </SetChip>
      ))}
    </ListEditor>
  );
}

export const listRows = (): SettingRow[] => [
  { id: "tags", name: "Etiketler", hint: "Kişi ve firmalara eklenir. Silinen etiket onu taşıyan kayıtlarda kalır, yeni kayda seçilemez", keywords: ["etiket", "renk"], wide: true, control: <Tags /> },
  { id: "sectors", name: "Sektörler", hint: "İki seviye: Ana > Alt. Ana sektör silinince alt sektörleri de gizlenir; kayıtlarda kalırlar", keywords: ["sektör", "alt sektör"], wide: true, control: <Sectors /> },
  { id: "sources", name: "Kaynaklar (nereden buldum)", hint: "Kişi, firma ve fırsatlarda seçilir. Silinen kaynak kayıtlarda kalır, yeni kayda seçilemez", keywords: ["kaynak", "nereden buldum"], wide: true, control: <Sources /> },
];
