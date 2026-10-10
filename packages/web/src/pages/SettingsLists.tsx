// Ayarlar: etiketler, sektörler, kaynaklar (nereden buldum) ve çöp kutusu
import { useState, type ReactNode } from "react";
import { remove, restore, run } from "../api/actions";
import { useSectors, useSources, useTags, useTrash } from "../api/keys";
import { Chip, Empty, ErrorBox, order, Who } from "../components/ui";
import { ago } from "../lib/format";
import { TAG_CLS, TAG_COLORS, TONE_CLS } from "../lib/labels";

function Card({ title, i, children, sub }: { title: string; i: number; children: ReactNode; sub?: string }) {
  return (
    <section className="card rise flex flex-col gap-6 px-9 py-8" style={order(i)} aria-label={title}>
      <div className="flex flex-col gap-1">
        <h2 className="card-title">{title}</h2>
        {sub ? <p className="m-0 text-base-sm text-text-secondary">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Ad yazıp Enter ile ekleme satırı */
function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd(name.trim());
      setName("");
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="flex gap-3" onSubmit={(e) => (e.preventDefault(), void add())}>
      <input className="inp min-w-0 flex-1" placeholder={placeholder} aria-label={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="btn btn-pri" disabled={busy || !name.trim()}>Ekle</button>
    </form>
  );
}

/** Yerinde ad değiştirme: tıklayınca alan olur, Enter ya da odak kaybı kaydeder */
function Rename({ value, onSave, className = "" }: { value: string; onSave: (v: string) => Promise<unknown>; className?: string }) {
  const [v, setV] = useState<string | null>(null);
  if (v === null) return <button type="button" className={`min-w-0 truncate border-0 bg-transparent p-0 text-left text-text-primary ${className}`} title="Adı değiştir" onClick={() => setV(value)}>{value}</button>;
  const done = () => {
    const n = v.trim();
    setV(null);
    if (n && n !== value) void onSave(n).catch(() => {});
  };
  return <input className="inp h-control-height-sm min-w-0 flex-1" aria-label="Yeni ad" value={v} autoFocus onChange={(e) => setV(e.target.value)} onBlur={done}
    onKeyDown={(e) => (e.key === "Enter" ? done() : e.key === "Escape" ? setV(null) : undefined)} />;
}

const count = (people: number, companies = 0, extra = "") =>
  [people ? `${people} kişi` : "", companies ? `${companies} firma` : "", extra].filter(Boolean).join(" · ") || "kullanılmıyor";

export function TagsCard() {
  const tags = useTags();
  const live = tags.rows.filter((t) => !t.deleted_at);
  return (
    <Card title="Etiketler" i={2} sub="Kişi ve firmalara eklenir. Silinen etiket onu taşıyan kayıtlarda kalır, yeni kayda seçilemez.">
      {tags.error && !tags.data ? <ErrorBox error={tags.error} retry={tags.reload} /> : null}
      <div className="flex flex-col">
        {live.map((t) => (
          <div key={t.id} className="row flex flex-wrap items-center gap-4 py-4">
            <span className={`chip ${TAG_CLS[t.color] ?? TONE_CLS.neutral}`}>
              <Rename value={t.name} className="text-inherit" onSave={(name) => run("patch", `/tags/${t.id}`, { name }, { ok: "Etiket güncellendi" })} />
            </span>
            <span className="flex-grow text-sm text-text-muted">{count(t.people_count, t.company_count)}</span>
            <select className="inp h-control-height-sm w-auto" aria-label={`${t.name} rengi`} value={t.color}
              onChange={(e) => void run("patch", `/tags/${t.id}`, { color: e.target.value }).catch(() => {})}>
              {TAG_COLORS.map((c) => <option key={c} value={c}>{COLOR_NAME[c] ?? c}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(`/tags/${t.id}`, `“${t.name}” etiketi`).catch(() => {})}>Sil</button>
          </div>
        ))}
      </div>
      <AddRow placeholder="Yeni etiket adı" onAdd={(name) => run("post", "/tags", { name }, { ok: "Etiket eklendi" })} />
    </Card>
  );
}

const COLOR_NAME: Record<string, string> = {
  aday: "Gri", musteri: "Yeşil", ajans: "Mavi", is_ortagi: "Mor", network: "Kum",
  opportunity: "Açık mavi", source: "Pembe", payment: "Sarı", warning: "Kırmızı", success: "Açık yeşil",
};

export function SectorsCard() {
  const sectors = useSectors();
  const live = sectors.rows.filter((s) => !s.deleted_at);
  return (
    <Card title="Sektörler" i={3} sub="İki seviye: Ana > Alt. Ana sektör silinince alt sektörleri de gizlenir; kayıtlarda kalırlar.">
      {sectors.error && !sectors.data ? <ErrorBox error={sectors.error} retry={sectors.reload} /> : null}
      {sectors.data && live.length === 0 ? <Empty>Henüz sektör yok.</Empty> : null}
      <div className="flex flex-col">
        {live.map((s) => (
          <div key={s.id} className={`row flex items-center gap-4 py-4 ${s.parent_id ? "pl-7" : ""}`}>
            <Rename value={s.name} className={s.parent_id ? "text-base-sm" : "text-base font-medium"}
              onSave={(name) => run("patch", `/sectors/${s.id}`, { name }, { ok: "Sektör güncellendi" })} />
            <span className="flex-grow text-sm text-text-muted">{count(s.people_count, s.company_count)}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(`/sectors/${s.id}`, `“${s.name}” sektörü`).catch(() => {})}>Sil</button>
          </div>
        ))}
      </div>
      <AddRow placeholder="Sağlık ya da Sağlık > Diş hekimi" onAdd={(name) => run("post", "/sectors", { name }, { ok: "Sektör eklendi" })} />
    </Card>
  );
}

export function SourcesCard() {
  const sources = useSources();
  const live = sources.rows.filter((s) => !s.deleted_at);
  return (
    <Card title="Kaynaklar (nereden buldum)" i={4} sub="Kişi, firma ve fırsatlarda seçilir. Silinen kaynak kayıtlarda kalır, yeni kayda seçilemez.">
      {sources.error && !sources.data ? <ErrorBox error={sources.error} retry={sources.reload} /> : null}
      {sources.data && live.length === 0 ? <Empty>Henüz kaynak yok.</Empty> : null}
      <div className="flex flex-col">
        {live.map((x) => (
          <div key={x.id} className="row flex items-center gap-4 py-4">
            <Chip tone="source"><Rename value={x.name} className="text-inherit" onSave={(name) => run("patch", `/sources/${x.id}`, { name }, { ok: "Kaynak güncellendi" })} /></Chip>
            <span className="flex-grow text-sm text-text-muted">{count(x.people_count, x.company_count, x.opp_count ? `${x.opp_count} fırsat` : "")}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(`/sources/${x.id}`, `“${x.name}” kaynağı`).catch(() => {})}>Sil</button>
          </div>
        ))}
      </div>
      <AddRow placeholder="Yeni kaynak adı" onAdd={(name) => run("post", "/sources", { name, kind: "diger" }, { ok: "Kaynak eklendi" })} />
    </Card>
  );
}

/** Çöp kutusu: silinen kayıtlar (alt kayıtlarıyla) ve gizlenen kategoriler; geri yükle */
export function TrashCard() {
  const trash = useTrash();
  const [all, setAll] = useState(false);
  const list = all ? trash.rows : trash.rows.slice(0, 12);
  return (
    <Card title="Çöp kutusu" i={5} sub="Sildiğin her şey burada durur. Geri yükleyince temasları, notları ve yorumlarıyla aynen döner.">
      {trash.error && !trash.data ? <ErrorBox error={trash.error} retry={trash.reload} /> : null}
      {trash.data && trash.rows.length === 0 ? <Empty>Çöp kutusu boş.</Empty> : null}
      <div className="flex flex-col">
        {list.map((x) => (
          <div key={`${x.type}-${x.id}`} className="row flex flex-wrap items-center gap-4 py-4">
            <span className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="truncate text-base">{x.label}</span>
              <span className="flex items-center gap-2 text-sm text-text-muted">
                {cap(x.what)} · {ago(x.deleted_at)} silindi
                {x.deleted_by ? <Who actor={x.deleted_by} /> : null}
              </span>
            </span>
            <button type="button" className="btn btn-sec btn-sm" onClick={() => void restore(x.type, x.id).catch(() => {})}>Geri yükle</button>
          </div>
        ))}
      </div>
      {trash.rows.length > 12 && !all ? <button type="button" className="btn btn-ghost self-start px-0 text-base-sm" onClick={() => setAll(true)}>{trash.rows.length - 12} kayıt daha</button> : null}
    </Card>
  );
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);
