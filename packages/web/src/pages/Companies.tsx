import { useMemo, useRef, useState, type Ref } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove } from "../api/actions";
import { companyCardKey, useCompanies, useSectors } from "../api/keys";
import { useQuery } from "../api/store";
import type { CompanyCard, Company, List, Touch } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { openSheet } from "../app/ui";
import { Comments, ContactList, EditDelete, LabelLine, Section, TouchList } from "../components/contact";
import { LabelFilters, matchLabels, noFilter, type LabelFilter } from "../components/filters";
import { Avatar, Chip, Empty, ErrorBox, PageSkeleton, StatusChip, Tags, Who } from "../components/ui";
import { ago, fmtDay, norm, tl } from "../lib/format";
import { CHANNEL_DOT, CONTACT_STATUSES, STAGE, STAGE_TONE, STATUS_DOT } from "../lib/labels";
import { channelName, netStatus } from "../lib/network";

export default function Companies() {
  const companies = useCompanies();
  const sectors = useSectors();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [f, setF] = useState<LabelFilter>(noFilter);
  const [q, setQ] = useState("");
  const detailRef = useRef<HTMLElement>(null);

  const shown = useMemo(() => {
    const n = norm(q.trim());
    return companies.rows.filter((c) => matchLabels(c, f, sectors.rows) &&
      (!n || [c.name, c.website, c.email, c.sector_path, c.tags.join(" ")].some((x) => norm(x).includes(n))));
  }, [companies.rows, sectors.rows, f, q]);
  const counts = useMemo(() => Object.fromEntries(CONTACT_STATUSES.map((s) => [s, companies.rows.filter((c) => c.contact_status === s).length])), [companies.rows]);
  const selId = Number(params.id) || shown[0]?.id;

  const select = (id: number) => {
    navigate(`${PATHS.companies}/${id}`, { replace: true });
    if (!matchMedia("(hover: hover)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <Page
      title="Firmalar"
      sub={companies.data ? `${companies.rows.length} firma · ${counts.yazilmadi ?? 0} yazılmadı · ${counts.cevap_geldi ?? 0} cevap geldi` : ""}
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("company")}>Firma ekle</button>}
      className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-9"
    >
      {companies.error && !companies.data ? <ErrorBox error={companies.error} retry={companies.reload} /> : null}
      {!companies.data ? (
        !companies.error && <PageSkeleton />
      ) : (
        <>
          <section className="flex min-w-0 flex-col gap-6">
            <div className="rise"><LabelFilters value={f} onChange={setF} counts={counts} /></div>
            <input className="inp rise" type="search" placeholder="Firma, site, sektör ya da etiket ara" aria-label="Firma ara" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="card rise overflow-hidden">
              {shown.length === 0 ? <Empty>Burada firma yok. “Firma ekle” ile ekleyebilir ya da listeyi Claude’a verebilirsin.</Empty> : null}
              {shown.map((c) => <CompanyRow key={c.id} c={c} active={c.id === selId} onPick={select} />)}
            </div>
            <LooseContacts />
          </section>
          {selId ? <Card key={selId} id={selId} ref={detailRef} /> : null}
        </>
      )}
    </Page>
  );
}

function CompanyRow({ c, active, onPick }: { c: Company; active: boolean; onPick: (id: number) => void }) {
  return (
    <button
      type="button"
      data-record={`company-${c.id}`}
      onClick={() => onPick(c.id)}
      aria-current={active || undefined}
      className={`row cv-auto flex w-full items-center gap-5 border-x-0 border-t-0 px-7 py-5 text-left text-text-primary ${active ? "bg-surface-2" : "bg-transparent"}`}
    >
      <Avatar name={c.name} size="list" />
      <span className="flex min-w-0 flex-grow flex-col gap-0.5">
        <span className="truncate text-base font-medium">{c.name}</span>
        <span className="truncate text-base-sm text-text-secondary">{[c.sector_path, c.website ?? c.email].filter(Boolean).join(" · ") || "Bilgi yok"}</span>
        <span className="flex items-center gap-2 truncate text-sm text-text-muted">
          <span className={`dot ${STATUS_DOT[c.contact_status]}`} />
          {c.people_count ? `${c.people_count} kişi · ` : ""}{c.last_touch_at ? `son temas ${ago(c.last_touch_at)}` : "henüz temas yok"}
        </span>
      </span>
      <span className="flex flex-col items-end gap-2">
        <StatusChip status={c.contact_status} />
        <span className="flex flex-wrap justify-end gap-1"><Tags ids={c.tag_ids} /></span>
      </span>
    </button>
  );
}

// ------------------------------------------------------------ firma kartı
function Card({ id, ref }: { id: number; ref: Ref<HTMLElement> }) {
  const d = useQuery<CompanyCard>(companyCardKey(id));
  const [, navigate] = useLocation();
  const c = d.data;
  if (!c) {
    return (
      <aside ref={ref} className="card detail p-9" aria-busy={!d.error}>
        {d.error ? <ErrorBox error={d.error} retry={d.reload} /> : <div className="h-chart-height" />}
      </aside>
    );
  }
  const co = c.row;
  const del = () => remove(`/companies/${co.id}`, co.name).then(() => navigate(PATHS.companies, { replace: true })).catch(() => {});

  return (
    <aside ref={ref} className="card slide-in flex scroll-mt-7 flex-col gap-8 p-9" aria-label="Firma kartı">
      <div className="flex items-start gap-5">
        <Avatar name={co.name} size="xl" />
        <div className="flex min-w-0 flex-grow flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">{co.name}</h2>
          <span className="text-base-sm text-text-secondary">
            {co.people_count ? `${co.people_count} kişi` : "Kişi yok"} · {co.touch_count ? `${co.touch_count} temas` : "temas yok"}{co.open_opps ? ` · ${co.open_opps} açık fırsat` : ""}
          </span>
          <div className="mt-1 flex flex-wrap gap-2"><Who actor={co.created_by} /></div>
        </div>
        <EditDelete label={co.name} onEdit={() => openSheet("company", { edit: co.id })} onDelete={del} />
      </div>

      <LabelLine r={co} />

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { company_id: co.id })}>Firmaya temas</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("draft", { company_id: co.id, channel: "email" })}>Taslak yaz</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("person", { company_id: co.id })}>Kişi ekle</button>
      </div>

      <ContactList c={co} />

      <Section title={`Çalışanlar (${c.people.length})`}>
        {c.people.length === 0 ? <span className="text-base-sm text-text-muted">Henüz kişi yok. Cevap veren kişiyi ekleyince temasları burada da görünür.</span> : null}
        {c.people.map((p) => {
          const st = netStatus(p);
          return (
            <Link key={p.id} href={`${PATHS.people}/${p.id}`} className="inset flex items-center gap-3 px-5 py-4 text-text-primary hover:text-text-primary">
              <Avatar name={p.name} size="sm" />
              <span className="flex min-w-0 flex-grow flex-col">
                <span className="truncate text-base">{p.name}</span>
                {st ? <span className={`truncate text-sm ${st.late ? "text-status-text-attention" : "text-text-muted"}`}>{st.text}</span> : null}
              </span>
              <StatusChip status={p.contact_status} />
            </Link>
          );
        })}
      </Section>

      <Section title="Temaslar (firmaya ve çalışanlarına)">
        {c.channels.length ? (
          <div className="flex flex-wrap gap-3">
            {c.channels.map((ch) => (
              <span key={ch.channel} className="fchip inline-flex items-center gap-2" title={`son ${fmtDay(ch.last_at)}`}>
                <span className={`dot ${CHANNEL_DOT[ch.channel] ?? "bg-accent-neutral"}`} />
                {channelName(ch.channel)} {ch.out_count}↗ {ch.in_count}↙
              </span>
            ))}
          </div>
        ) : <span className="text-base-sm text-text-muted">Henüz temas yok.</span>}
        {c.touches.rows.length ? <TouchList list={c.touches.rows} showTo /> : null}
      </Section>

      {c.opportunities.length + c.drafts.length ? (
        <Section title="Satış">
          {c.drafts.length ? <Link href={PATHS.drafts} className="text-base-sm">{c.drafts.length} taslak onay bekliyor</Link> : null}
          {c.opportunities.map((o) => (
            <Link key={o.id} href={timelinePath("opportunity", o.id)} className="inset flex items-center gap-3 px-5 py-4 text-text-primary hover:text-text-primary">
              <span className="min-w-0 flex-grow truncate text-base">{o.title} <span className="text-text-muted">· {o.person_name}</span></span>
              {o.estimated_value ? <span className="font-mono text-base-sm text-text-secondary">{tl(o.estimated_value)}</span> : null}
              <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
            </Link>
          ))}
        </Section>
      ) : null}

      <Comments target={{ type: "company", id: co.id, label: co.name }} threads={c.threads} />

      {co.notes ? <p className="inset m-0 whitespace-pre-line px-6 py-5 text-base-sm leading-normal text-text-body">{co.notes}</p> : null}
    </aside>
  );
}

/**
 * Sadece adresle yazılanlar (info@, @hesap): cevap gelince tek tıkla kişiye ya da firmaya dönüşür.
 * O adresle kayıt açılınca temaslar kendiliğinden ona bağlanır.
 */
function LooseContacts() {
  const loose = useQuery<List<Touch>>("/touches?loose=true&limit=500");
  const groups = useMemo(() => {
    const m = new Map<string, { contact: string; count: number; last: string; replied: boolean }>();
    for (const t of loose.data?.rows ?? []) {
      const k = t.contact ?? "";
      const g = m.get(k) ?? { contact: k, count: 0, last: t.happened_at, replied: false };
      g.count++;
      if (t.happened_at > g.last) g.last = t.happened_at;
      if (t.direction === "gelen") g.replied = true;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => Number(b.replied) - Number(a.replied) || b.last.localeCompare(a.last));
  }, [loose.data]);
  if (!groups.length) return null;
  return (
    <section className="card rise flex flex-col gap-4 p-8" aria-label="Sadece adresle yazılanlar">
      <h2 className="m-0 text-base font-semibold">Sadece adresle yazılanlar ({groups.length})</h2>
      <p className="m-0 text-base-sm text-text-secondary">Kişi ya da firma açmadan yazdıkların. Dönüştürünce temasları kayda taşınır.</p>
      {groups.map((g) => (
        <div key={g.contact} className="row flex flex-wrap items-center gap-3 py-3">
          <span className="flex min-w-0 flex-grow flex-col">
            <span className="truncate text-base">{g.contact}</span>
            <span className="text-sm text-text-muted">{g.count} temas · {ago(g.last)}{g.replied ? " · cevap geldi" : ""}</span>
          </span>
          <button type="button" className="btn btn-sec btn-sm" onClick={() => openSheet("person", { contact: g.contact })}>Kişi yap</button>
          <button type="button" className="btn btn-sec btn-sm" onClick={() => openSheet("company", { contact: g.contact })}>Firma yap</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("touch", { contact: g.contact })}>Temas</button>
        </div>
      ))}
    </section>
  );
}
