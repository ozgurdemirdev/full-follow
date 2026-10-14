import { useMemo, useState } from "react";
import { remove } from "../../api/actions";
import { companyCardKey } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { CompanyCard } from "../../api/types";
import { openSheet } from "../../app/ui";
import { askCompanyDraft, buildStream, SEGMENT_LABEL, siteLabel, type CompanyView } from "../../lib/companies";
import { initials } from "../../lib/format";
import { webUrl } from "../../lib/network";
import { useDayMarks } from "../../lib/people";
import { usePopover } from "../../lib/usePopover";
import { BoardIcon } from "../boardIcons";
import { ExpandOverlay } from "../ExpandOverlay";
import { toast } from "../toast";
import { avatarPair, ErrorBox, Skeleton } from "../ui";
import { Aside } from "./Aside";
import { CompanyComposer, CompanyStream } from "./CompanyStream";
import { OrgPeople } from "./OrgPeople";

/** Claude mode of the composer: `id` is the company it was switched on for, `replyTo` the thread being answered */
interface ClaudeMode {
  id: number;
  replyTo: number | null;
}

/** Menu of the header: the parts the board leaves out (detailed touch and draft forms, editing the fields, delete) */
function HeaderMenu({ v, onClaude, onClose }: { v: CompanyView; onClaude: () => void; onClose: () => void }) {
  const { open, setOpen, root } = usePopover();
  const c = v.c;
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-round" aria-label="Diğer işlemler" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={2.4} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop" inert={!open}>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("touch", { company_id: c.id }))}>Temas ekle</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("draft", { company_id: c.id, channel: "email" }))}>Taslak yaz</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(onClaude)}>Claude’a yaz</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("company", { edit: c.id }))}>Düzenle, web ve hesaplar</button>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/companies/${c.id}`, c.name).then(onClose).catch(() => {}))}>Sil</button>
      </div>
    </div>
  );
}

/** Both columns once the card is loaded; the list data (money, people, projects) is already there */
function Body({ v, max, card, claude, onClaude }: { v: CompanyView; max: number; card?: CompanyCard; claude: ClaudeMode | null; onClaude: (m: ClaudeMode | null) => void }) {
  const items = useMemo(() => (card ? buildStream(card) : []), [card]);
  const on = claude?.id === v.c.id;
  return (
    <>
      <Aside v={v} max={max} card={card} />
      <div className="co-main">
        <OrgPeople people={v.people} />
        <div className="co-section">
          <h3 className="co-h3">Temaslar</h3>
          <CompanyComposer company={v.c} card={card} claude={on} replyTo={on ? claude.replyTo : null} onClaude={(next) => onClaude(next ? { id: v.c.id, replyTo: null } : null)} />
          {card ? <CompanyStream items={items} pair={avatarPair(v.c.name, v.c.id)} onReply={(thread) => onClaude({ id: v.c.id, replyTo: thread })} /> : <Skeleton className="h-chart-height" />}
        </div>
      </div>
    </>
  );
}

/** A company as the board's dialog: grows from the clicked tile, header with the actions, money and facts left, people and stream right */
export function CompanyOverlay({ id, from, v, max, onClose }: { id: number | null; from: DOMRect | null; v: CompanyView | undefined; max: number; onClose: () => void }) {
  const d = useQuery<CompanyCard>(id ? companyCardKey(id) : null);
  const [drafted, markDrafted] = useDayMarks("companyDrafted");
  const [claude, setClaude] = useState<ClaudeMode | null>(null);

  const ask = () => {
    if (!v) return;
    if (drafted.has(v.c.id)) return toast("Taslak zaten yazılıyor");
    askCompanyDraft(v.c).then(() => markDrafted(v.c.id)).catch(() => {});
  };
  const site = v?.c.website ? siteLabel(v.c.website) : null;
  const sub = v ? [v.c.sector_path, v.c.city].filter(Boolean).join(" · ") : "";

  return (
    <ExpandOverlay
      open={!!id && !!v}
      from={from}
      title={v?.c.name ?? "Firma"}
      onClose={onClose}
      bodyClassName="ppl-body co-body"
      header={v ? (
        <>
          <span className={`co-mono is-lg ${avatarPair(v.c.name, v.c.id)}`} aria-hidden="true">{initials(v.c.name)}</span>
          <div className="flex min-w-0 flex-grow flex-col gap-1">
            <div className="flex flex-wrap items-center gap-4">
              <h2>{v.c.name}</h2>
              <span className="ppl-hchip" data-seg={v.segment}>{SEGMENT_LABEL[v.segment]}</span>
            </div>
            <span className="text-base text-text-secondary">
              {sub}
              {site ? <>{sub ? " · " : ""}<a href={webUrl(v.c.website!)} target="_blank" rel="noreferrer" className="text-text-soft">{site}</a></> : null}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="co-btn" onClick={() => openSheet("person", { company_id: v.c.id })}>Kişi ekle</button>
            <button type="button" className="ppl-ask" onClick={ask}>
              <BoardIcon name="pen" className="size-icon-chip" />
              {drafted.has(v.c.id) ? "Taslak istendi" : "Claude’dan taslak iste"}
            </button>
            <HeaderMenu v={v} onClaude={() => setClaude({ id: v.c.id, replyTo: null })} onClose={onClose} />
            <button type="button" className="ppl-round" data-close aria-label="Kapat" onClick={onClose}>
              <BoardIcon name="close" className="size-icon-md" stroke={2} />
            </button>
          </div>
        </>
      ) : null}
    >
      {v ? (
        d.error && !d.data ? <ErrorBox error={d.error} retry={d.reload} /> : <Body key={v.c.id} v={v} max={max} card={d.data} claude={claude} onClaude={setClaude} />
      ) : null}
    </ExpandOverlay>
  );
}
