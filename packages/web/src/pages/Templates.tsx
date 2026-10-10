import { useState } from "react";
import { remove as trash } from "../api/actions";
import { useTemplates } from "../api/keys";
import type { Template } from "../api/types";
import { Page } from "../app/Page";
import { openSheet } from "../app/ui";
import { Chip, Empty, ErrorBox, Filters, order, PageSkeleton, Who } from "../components/ui";
import { pct } from "../lib/format";
import { CHANNEL, TEMPLATE_KIND, TEMPLATE_KINDS } from "../lib/labels";

// Mesaj şablonları: sektör ve kanala göre; taslak yazarken kişiye uygun olanı önerilir
export default function Templates() {
  const t = useTemplates();
  const [kind, setKind] = useState("");
  const shown = t.rows.filter((x) => !kind || x.kind === kind);
  const sent = t.rows.reduce((a, x) => a + x.sent, 0);
  const replied = t.rows.reduce((a, x) => a + x.replied, 0);

  return (
    <Page
      title="Şablonlar"
      sub={t.data ? `${t.rows.length} şablon${sent ? ` · şablonla gönderilen ${sent} mesajın ${replied} tanesine dönüş (${pct(replied / sent)})` : ""}` : ""}
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("template")}>Şablon ekle</button>}
      width="narrow"
      className="flex flex-col gap-7"
    >
      {t.error && !t.data ? <ErrorBox error={t.error} retry={t.reload} /> : null}
      {!t.data ? (
        !t.error && <PageSkeleton />
      ) : (
        <>
          <div className="rise">
            <Filters label="Tür" value={kind} onChange={setKind} items={[{ value: "", label: "Hepsi" }, ...TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND[k] }))]} />
          </div>
          {shown.length === 0 ? (
            <div className="card"><Empty>Şablon yok. Sektöre ve kanala göre ilk mesaj ve takip şablonları ekle; takip dizisi de “Takip” türündeki şablonu kullanır.</Empty></div>
          ) : null}
          {shown.map((x, i) => <TemplateCard key={x.id} t={x} i={i} />)}
        </>
      )}
    </Page>
  );
}

function TemplateCard({ t, i }: { t: Template; i: number }) {
  const remove = () => {
    void trash(`/templates/${t.id}`, `“${t.name}” şablonu`).catch(() => {});
  };
  return (
    <article className="card rise-item flex flex-col gap-4 px-9 py-8" style={order(i)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-md font-semibold">{t.name}</span>
        <Who actor={t.created_by} />
        <span className="flex-grow" />
        <Chip tone={t.kind === "takip" ? "claude" : "neutral"}>{TEMPLATE_KIND[t.kind]}</Chip>
        <Chip tone="opportunity">{t.channel ? CHANNEL[t.channel] : "Tüm kanallar"}</Chip>
        <Chip tone="source">{t.sector_path ?? "Tüm sektörler"}</Chip>
      </div>
      <p className="inset m-0 whitespace-pre-line px-7 py-6 text-base leading-relaxed">{t.body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base-sm text-text-secondary">
          {t.used ? `${t.used} taslakta kullanıldı` : "Henüz kullanılmadı"}
          {t.sent ? ` · ${t.sent} gönderildi, ${t.replied} dönüş (${pct(t.reply_rate)})` : ""}
        </span>
        <span className="flex-grow" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("template", { template_id: t.id })}>Düzenle</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>Sil</button>
      </div>
    </article>
  );
}
