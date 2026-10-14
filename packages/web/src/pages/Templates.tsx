import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePeople, useTemplates } from "../api/keys";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { openSheet } from "../app/ui";
import { BoardIcon } from "../components/boardIcons";
import { TileColumns } from "../components/layout";
import { TemplateOverlay } from "../components/templates/TemplateOverlay";
import { TemplateTile } from "../components/templates/TemplateTile";
import { Card, Empty, ErrorBox, Filters, PageSkeleton } from "../components/ui";
import { TEMPLATE_KIND, TEMPLATE_KINDS } from "../lib/labels";
import { byRate } from "../lib/templates";

/** Size of the box the overlay grows from when a template is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

const KIND_ITEMS = [{ value: "", label: "Hepsi" }, ...TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND[k] }))];

/** Message templates: tiles by reply rate, the template overlay (the address /sablonlar/:id opens it) */
export default function Templates() {
  const templates = useTemplates();
  const people = usePeople();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const openId = Number(params.id) || null;

  const shown = useMemo(() => templates.rows.filter((t) => !kind || t.kind === kind).sort(byRate), [templates.rows, kind]);
  const open = useCallback((id: number, rect: DOMRect) => {
    setFrom(rect);
    navigate(`${PATHS.templates}/${id}`, { replace: true });
  }, [navigate]);
  const current = openId ? templates.byId.get(openId) : undefined;

  return (
    <Page
      title="Şablonlar"
      sub="Hangi mesaj cevap alıyor, ölçerek seç"
      right={
        <button type="button" className="dash-new" onClick={() => openSheet("template")}>
          <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
          Şablon ekle
        </button>
      }
    >
      {templates.error && !templates.data ? <ErrorBox error={templates.error} retry={templates.reload} /> : null}
      {!templates.data ? (
        !templates.error && <PageSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Filters label="Tür" value={kind} onChange={setKind} items={KIND_ITEMS} />
            <span className="flex-grow" />
            <span className="text-base-sm text-text-muted">Cevap oranına göre sıralı</span>
          </div>
          {shown.length === 0 ? (
            <Card label="Şablonlar"><Empty>Şablon yok. Sektöre ve kanala göre ilk mesaj ve takip şablonları ekle; takip dizisi de “Takip” türündeki şablonu kullanır.</Empty></Card>
          ) : (
            <TileColumns>{shown.map((t) => <TemplateTile key={t.id} t={t} onOpen={open} />)}</TileColumns>
          )}
          <TemplateOverlay t={current} from={openId ? (from ?? fallbackRect()) : from} people={people.rows}
            onClose={() => navigate(PATHS.templates, { replace: true })} />
        </>
      )}
    </Page>
  );
}
