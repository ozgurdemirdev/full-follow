import { useMemo, useRef, useState, type Ref } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove, run } from "../api/actions";
import { cardKey, usePeople, useSectors } from "../api/keys";
import { useQuery } from "../api/store";
import type { Person, PersonCard } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { openSheet } from "../app/ui";
import { Comments, ContactList, EditDelete, LabelLine, Section, TouchList } from "../components/contact";
import { LabelFilters, matchLabels, noFilter, type LabelFilter } from "../components/filters";
import { Avatar, Chip, Empty, ErrorBox, Filters, PageSkeleton, Tags, Who } from "../components/ui";
import { ago, fmtDay, followNote, norm, tl, todayIso } from "../lib/format";
import { CHANNEL_DOT, IDEA_STAGE, INTEREST, INTEREST_TONE, PLATFORM, PROJECT_STAGE, STAGE, STAGE_TONE, isKnown } from "../lib/labels";
import { channelName, netStatus } from "../lib/network";

type State = "" | "awaiting" | "cooling" | "follow";
const STATES: { value: State; label: string; test: (p: Person) => boolean }[] = [
  { value: "", label: "Hepsi", test: () => true },
  { value: "awaiting", label: "Cevap bekleyen", test: (p) => !!p.awaiting },
  { value: "cooling", label: "Soğuyan", test: (p) => p.cooling },
  { value: "follow", label: "Takibi gelen", test: (p) => !!p.next_follow_up_at && p.next_follow_up_at <= todayIso() },
];

export default function People() {
  const people = usePeople();
  const sectors = useSectors();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [state, setState] = useState<State>("");
  const [f, setF] = useState<LabelFilter>(noFilter);
  const [q, setQ] = useState("");
  const detailRef = useRef<HTMLElement>(null);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    const st = STATES.find((s) => s.value === state)!.test;
    const list = people.rows.filter((p) => st(p) && matchLabels(p, f, sectors.rows) &&
      (!n || [p.name, p.company_name, p.role, p.sector_path, p.email, p.instagram, p.linkedin, p.tags.join(" ")].some((x) => norm(x).includes(n))));
    if (state === "awaiting") list.sort((a, b) => (b.awaiting?.days ?? 0) - (a.awaiting?.days ?? 0));
    if (state === "cooling") list.sort((a, b) => b.days_since - a.days_since);
    return list;
  }, [people.rows, sectors.rows, state, f, q]);
  const counts = useMemo(() => ({ awaiting: people.rows.filter((p) => p.awaiting).length, cooling: people.rows.filter((p) => p.cooling).length }), [people.rows]);
  const selId = Number(params.id) || shown[0]?.id;

  const select = (id: number) => {
    navigate(`${PATHS.people}/${id}`, { replace: true });
    // mobilde kart listenin altında: oraya kaydır
    if (!matchMedia("(hover: hover)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <Page
      title="Kişiler"
      sub={people.data ? `${people.rows.length} kişi · ${counts.awaiting} cevap bekliyor · ${counts.cooling} soğuyor` : ""}
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("person")}>Kişi ekle</button>}
      className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-9"
    >
      {people.error && !people.data ? <ErrorBox error={people.error} retry={people.reload} /> : null}
      {!people.data ? (
        !people.error && <PageSkeleton />
      ) : (
        <>
          <section className="flex min-w-0 flex-col gap-6">
            <div className="rise flex flex-col gap-4">
              <Filters label="Durum" value={state} onChange={setState} items={STATES.map((s) => ({ value: s.value, label: s.value === "awaiting" ? `${s.label} ${counts.awaiting || ""}`.trim() : s.value === "cooling" ? `${s.label} ${counts.cooling || ""}`.trim() : s.label }))} />
              <LabelFilters value={f} onChange={setF} />
            </div>
            <input className="inp rise" type="search" placeholder="İsim, firma, sektör, etiket ya da hesap ara" aria-label="Kişi ara" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="card rise overflow-hidden">
              {shown.length === 0 ? <Empty>Burada kimse yok. Sağ alttaki + ile kişi ekleyebilirsin.</Empty> : null}
              {shown.map((p) => <PersonRow key={p.id} p={p} active={p.id === selId} onPick={select} />)}
            </div>
          </section>
          {selId ? <Card key={selId} id={selId} ref={detailRef} /> : null}
        </>
      )}
    </Page>
  );
}

function PersonRow({ p, active, onPick }: { p: Person; active: boolean; onPick: (id: number) => void }) {
  const st = netStatus(p);
  const follow = followNote(p.next_follow_up_at);
  return (
    <button
      type="button"
      onClick={() => onPick(p.id)}
      aria-current={active || undefined}
      className={`row cv-auto flex w-full items-center gap-5 border-x-0 border-t-0 px-7 py-5 text-left text-text-primary ${active ? "bg-surface-2" : "bg-transparent"}`}
    >
      <Avatar name={p.name} size="list" />
      <span className="flex min-w-0 flex-grow flex-col gap-0.5">
        <span className="truncate text-base font-medium">{p.name}</span>
        <span className="truncate text-base-sm text-text-secondary">{[p.role, p.company_name, p.sector_path].filter(Boolean).join(" · ") || p.handle || p.email || ""}</span>
        {st ? (
          <span className={`flex items-center gap-2 truncate text-sm ${st.late ? "text-status-text-attention" : "text-text-muted"}`}>
            {p.last_channel ? <span className={`dot ${CHANNEL_DOT[p.awaiting?.channel ?? p.last_channel] ?? "bg-accent-neutral"}`} /> : null}
            {st.text}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col items-end gap-2">
        <span className="flex flex-wrap justify-end gap-1"><Tags ids={p.tag_ids} /><Who actor={p.created_by} /></span>
        {follow ? <span className={`text-sm ${follow.late ? "text-status-text-attention" : "text-text-secondary"}`}>{follow.text}</span> : null}
      </span>
    </button>
  );
}

// ------------------------------------------------------------ kişi kartı (ana merkez)
function Card({ id, ref }: { id: number; ref: Ref<HTMLElement> }) {
  const d = useQuery<PersonCard>(cardKey(id));
  const [, navigate] = useLocation();
  const [channel, setChannel] = useState("");
  const c = d.data;
  if (!c) {
    return (
      <aside ref={ref} className="card detail p-9" aria-busy={!d.error}>
        {d.error ? <ErrorBox error={d.error} retry={d.reload} /> : <div className="h-chart-height" />}
      </aside>
    );
  }
  const p = c.row;
  const st = netStatus(p);
  const touches = channel ? c.touches.rows.filter((t) => t.channel === channel) : c.touches.rows;
  const ask = () =>
    run("post", "/tasks", { title: `${p.name} için mesaj taslağı hazırla`, assignee: "claude", due_date: todayIso(), person_id: p.id }, { ok: "Claude’a görev verildi, taslak onayına düşecek" });
  const del = () => remove(`/people/${p.id}`, p.name).then(() => navigate(PATHS.people, { replace: true })).catch(() => {});

  return (
    <aside ref={ref} className="card slide-in flex scroll-mt-7 flex-col gap-8 p-9" aria-label="Kişi kartı">
      <div className="flex items-start gap-5">
        <Avatar name={p.name} size="xl" />
        <div className="flex min-w-0 flex-grow flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">{p.name}</h2>
          <span className="text-base-sm text-text-secondary">
            {p.role ? `${p.role} · ` : ""}{p.company_id ? <Link href={`${PATHS.companies}/${p.company_id}`}>{p.company_name}</Link> : "Firma yok"}
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            <Who actor={p.created_by} />
            {st ? <Chip tone={st.tone}>{st.text}</Chip> : isKnown(p.contact_status) ? null : <Chip>Henüz temas yok</Chip>}
          </div>
        </div>
        <EditDelete label={p.name} onEdit={() => openSheet("person", { person_id: p.id })} onDelete={del} />
      </div>

      <LabelLine r={p} />

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { person_id: p.id })}>Temas ekle</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("draft", { person_id: p.id, channel: p.awaiting?.channel ?? p.last_channel ?? undefined })}>Taslak yaz</button>
        <button type="button" className="btn btn-sec" onClick={ask}>Claude’dan taslak iste</button>
      </div>

      <ContactList c={p} />

      {c.channels.length === 0 && isKnown(p.contact_status) ? null : <Section title="Kanallar">
        {c.channels.length === 0 ? <span className="text-base-sm text-text-muted">Henüz temas yok. Fırsat açmadan doğrudan temas ekleyebilirsin.</span> : (
          <div className="flex flex-wrap gap-3" role="group" aria-label="Kanala göre süz">
            <button type="button" className="fchip" aria-pressed={!channel} onClick={() => setChannel("")}>Hepsi {c.touches.total}</button>
            {c.channels.map((ch) => (
              <button key={ch.channel} type="button" className="fchip inline-flex items-center gap-2" aria-pressed={channel === ch.channel} onClick={() => setChannel(channel === ch.channel ? "" : ch.channel)}
                title={`${ch.out_count} giden, ${ch.in_count} gelen · son ${fmtDay(ch.last_at)}`}>
                <span className={`dot ${CHANNEL_DOT[ch.channel] ?? "bg-accent-neutral"}`} />
                {channelName(ch.channel)} {ch.out_count}↗ {ch.in_count}↙
                {ch.awaiting ? <span className="text-status-text-attention">· bekliyor</span> : null}
              </button>
            ))}
          </div>
        )}
        {touches.length ? <TouchList list={touches} /> : null}
      </Section>}

      {c.post || c.ideas.length ? (
        <Section title="Pazarlama">
          {c.post ? (
            <Link href={`${PATHS.posts}/${c.post.id}`} className="text-base-sm">
              <span className="text-text-muted">Kaynak paylaşım · </span>{PLATFORM[c.post.platform]} · {c.post.title}
            </Link>
          ) : null}
          {c.ideas.map((x) => (
            <Link key={x.id} href={`${PATHS.ideas}/${x.idea_id}`} className="flex flex-wrap items-center gap-2 text-base-sm text-text-neutral-chip">
              <span className="text-text-muted">Fikir ·</span> {x.idea_title}
              <span className="text-text-muted">({IDEA_STAGE[x.idea_stage]})</span>
              <Chip tone={INTEREST_TONE[x.interest]}>{INTEREST[x.interest]}</Chip>
            </Link>
          ))}
        </Section>
      ) : null}

      <Notes personId={p.id} notes={c.notes} />

      <Comments target={{ type: "person", id: p.id, label: p.name }} threads={c.threads} />

      <Section title="Referans ağı">
        <span className="text-base-sm text-text-secondary">
          {c.referrer ? <Link href={`${PATHS.people}/${c.referrer.id}`}>{c.referrer.name} tanıttı</Link> : "Doğrudan bulundu"}
        </span>
        {c.referrals.length ? (
          <div className="ml-1 flex flex-col gap-2 border-l-2 border-border-default py-1 pl-6">
            {c.referrals.map((r) => (
              <Link key={r.id} href={`${PATHS.people}/${r.id}`} className="flex flex-wrap items-baseline gap-2 text-base-sm text-text-neutral-chip">
                <span className="text-text-muted">tanıttı ·</span> {r.name}
                {r.company_name ? <span className="text-text-muted">{r.company_name}</span> : null}
                {r.opps ? <span className="text-text-secondary">· {r.opps} fırsat{r.won ? `, ${r.won} kazanıldı` : ""}</span> : null}
                {r.network ? <span className="text-text-muted">· +{r.network} kişi</span> : null}
              </Link>
            ))}
          </div>
        ) : null}
        {c.referral_value ? <ReferralValueLine v={c.referral_value} /> : null}
      </Section>

      {c.opportunities.length + c.projects.length + c.drafts.length ? (
        <Section title="Satış ve projeler">
          {c.drafts.length ? <Link href={PATHS.drafts} className="text-base-sm">{c.drafts.length} taslak onay bekliyor</Link> : null}
          {c.opportunities.map((o) => (
            <Link key={`o${o.id}`} href={timelinePath("opportunity", o.id)} className="inset flex items-center gap-3 px-5 py-4 text-text-primary hover:text-text-primary">
              <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
              {o.estimated_value ? <span className="font-mono text-base-sm text-text-secondary">{tl(o.estimated_value)}</span> : null}
              <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
            </Link>
          ))}
          {c.projects.map((x) => (
            <Link key={`r${x.id}`} href={timelinePath("project", x.id)} className="inset flex items-center gap-3 px-5 py-4 text-text-primary hover:text-text-primary">
              <span className="min-w-0 flex-grow truncate text-base">{x.name}</span>
              <Chip tone="success">{PROJECT_STAGE[x.stage]}</Chip>
            </Link>
          ))}
        </Section>
      ) : null}

      {p.notes ? <p className="inset m-0 whitespace-pre-line px-6 py-5 text-base-sm leading-normal text-text-body">{p.notes}</p> : null}
      <Link href={timelinePath("person", p.id)} className="text-base-sm">Tüm zaman çizelgesi</Link>
    </aside>
  );
}

/** Tarihli notlar: eklenir, yerinde düzenlenir, silinir (geri alınabilir) */
function Notes({ personId, notes }: { personId: number; notes: PersonCard["notes"] }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await run("post", "/notes", { person_id: personId, body: body.trim() }, { ok: "Not eklendi" });
      setBody("");
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!editing?.body.trim()) return;
    await run("patch", `/notes/${editing.id}`, { body: editing.body.trim() }, { ok: "Not güncellendi" }).then(() => setEditing(null)).catch(() => {});
  };
  return (
    <Section title="Notlar">
      <div className="flex gap-3">
        <input className="inp min-w-0 flex-1" placeholder="Bu kişi hakkında bir not (ör. 2 kliniği var)" aria-label="Not yaz" value={body}
          onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        <button type="button" className="btn btn-sec" disabled={busy || !body.trim()} onClick={add}>Ekle</button>
      </div>
      {notes.map((n) => (
        <div key={n.id} className="flex items-start gap-3">
          <Who actor={n.created_by} className="w-comment-who justify-center" />
          {editing?.id === n.id ? (
            <div className="flex min-w-0 flex-grow gap-3">
              <input className="inp min-w-0 flex-1" aria-label="Notu düzenle" value={editing.body} autoFocus
                onChange={(e) => setEditing({ id: n.id, body: e.target.value })}
                onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), void save()) : e.key === "Escape" ? setEditing(null) : undefined)} />
              <button type="button" className="btn btn-sec" onClick={() => void save()}>Kaydet</button>
            </div>
          ) : (
            <div className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="whitespace-pre-line text-base-sm leading-normal">{n.body}</span>
              <span className="flex items-center gap-2 text-sm text-text-muted">
                {ago(n.created_at)}
                <span className="flex-grow" />
                <EditDelete label="Not" onEdit={n.created_by === "ozgur" ? () => setEditing({ id: n.id, body: n.body }) : undefined}
                  onDelete={() => void remove(`/notes/${n.id}`, "Not").catch(() => {})} />
              </span>
            </div>
          )}
        </div>
      ))}
    </Section>
  );
}

export function ReferralValueLine({ v }: { v: NonNullable<PersonCard["referral_value"]> }) {
  const parts = [
    `${v.direct} kişi tanıttı${v.network > v.direct ? ` (ağıyla ${v.network})` : ""}`,
    v.opps ? `${v.opps} fırsat` : "henüz fırsat yok",
    v.won ? `${v.won} kazanıldı · ${tl(v.won_value)}` : "",
    v.open_value ? `açıkta ${tl(v.open_value)}` : "",
    v.collected ? `tahsil edilen ${tl(v.collected)}` : "",
  ].filter(Boolean);
  return <p className="m-0 text-base-sm text-text-body"><span className="text-text-secondary">Referans değeri: </span>{parts.join(" · ")}</p>;
}
