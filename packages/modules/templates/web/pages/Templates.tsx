import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePeople } from "@kit/api/keys";
import { Page } from "@kit/app/Page";
import { TEMPLATES_PATH } from "../paths";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { TileColumns } from "@kit/components/layout";
import { TemplateOverlay } from "../components/TemplateOverlay";
import { TemplateTile } from "../components/TemplateTile";
import { Card, Empty, ErrorBox, Filters, order, PageSkeleton } from "@kit/components/ui";
import { TEMPLATE_KIND } from "@kit/lib/labels";
import { TEMPLATE_KINDS } from "../labels";
import { m } from "../messages";
import { byRate, useTemplates } from "../templates";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Size of the box the overlay grows from when a template is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

const KIND_ITEMS = [{ value: "", label: kit.all }, ...TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND[k] }))];

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
    navigate(`${TEMPLATES_PATH}/${id}`, { replace: true });
  }, [navigate]);
  const current = openId ? templates.byId.get(openId) : undefined;

  return (
    <Page
      title={m.label}
      sub={m.page.sub}
      right={
        <button type="button" className="dash-new" onClick={() => openSheet("template")}>
          <BoardIcon name="plus" className="size-icon-md" stroke={STROKE.medium} />
          {m.page.add}
        </button>
      }
    >
      {templates.error && !templates.data ? <ErrorBox error={templates.error} retry={templates.reload} /> : null}
      {!templates.data ? (
        !templates.error && <PageSkeleton />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 rise" style={order(1)}>
            <Filters label={kit.fields.kind} value={kind} onChange={setKind} items={KIND_ITEMS} />
            <span className="flex-grow" />
            <span className="text-base-sm text-text-muted">{m.page.sortedByRate}</span>
          </div>
          {shown.length === 0 ? (
            <Card label={m.label}><Empty>{m.page.empty}</Empty></Card>
          ) : (
            <div className="rise" style={order(2)}>
              <TileColumns>{shown.map((t) => <TemplateTile key={t.id} t={t} onOpen={open} />)}</TileColumns>
            </div>
          )}
          <TemplateOverlay t={current} from={openId ? (from ?? fallbackRect()) : from} people={people.rows}
            onClose={() => navigate(TEMPLATES_PATH, { replace: true })} />
        </>
      )}
    </Page>
  );
}
