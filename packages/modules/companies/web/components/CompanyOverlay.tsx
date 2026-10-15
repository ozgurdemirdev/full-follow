import { useState } from "react";
import { remove } from "@kit/api/actions";
import { companyCardKey } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { CompanyCard } from "@kit/api/types";
import { useRegistry } from "@kit/app/modules/registry";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { askCompanyDraft, SEGMENT_LABEL, siteLabel, type CompanyView } from "../companies";
import { initials } from "@kit/lib/format";
import { webUrl } from "@kit/lib/network";
import { useDayMarks } from "@kit/lib/people";
import { usePopover } from "@kit/lib/usePopover";
import { BoardIcon } from "@kit/components/boardIcons";
import { ExpandOverlay } from "@kit/components/ExpandOverlay";
import { toast } from "@kit/components/toast";
import { avatarPair, ErrorBox } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { STROKE } from "../constants";
import { m } from "../messages";
import { Aside } from "./Aside";

/** Claude mode of the composer: `id` is the company it was switched on for, `replyTo` the thread being answered */
interface ClaudeMode {
  id: number;
  replyTo: number | null;
}

/** Menu of the header: the parts the board leaves out (detailed touch and draft forms, editing the fields, delete) */
function HeaderMenu({ v, onClaude, onClose }: { v: CompanyView; onClaude: () => void; onClose: () => void }) {
  const { open, setOpen, root } = usePopover();
  const { quickByKind } = useRegistry();
  const c = v.c;
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-round" aria-label={m.overlay.moreActions} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={STROKE.menu} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop" inert={!open}>
        {quickByKind.has("touch") ? <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("touch", { company_id: c.id }))}>{m.overlay.addTouch}</button> : null}
        {quickByKind.has("draft") ? <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("draft", { company_id: c.id, channel: "email" }))}>{m.overlay.writeDraft}</button> : null}
        {quickByKind.has("touch") ? <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(onClaude)}>{m.overlay.writeToClaude}</button> : null}
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("company", { edit: c.id }))}>{m.overlay.editFields}</button>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/companies/${c.id}`, c.name).then(onClose).catch(() => {}))}>{kit.delete}</button>
      </div>
    </div>
  );
}

/** Both columns once the card is loaded; the list data (money, people, projects) is already there. The right column is filled by other modules (the people inside, the touches) */
function Body({ v, max, card, claude, onClaude }: { v: CompanyView; max: number; card?: CompanyCard; claude: ClaudeMode | null; onClaude: (m: ClaudeMode | null) => void }) {
  const on = claude?.id === v.c.id;
  return (
    <>
      <Aside v={v} max={max} card={card} />
      <div className="co-main">
        <Slot name="company.overlay.main" props={{ people: v.people, company: v.c, card, claude: on ? claude : null, onClaude }} />
      </div>
    </>
  );
}

/** A company as the board's dialog: grows from the clicked tile, header with the actions, money and facts left, people and stream right */
export function CompanyOverlay({ id, from, v, max, onClose }: { id: number | null; from: DOMRect | null; v: CompanyView | undefined; max: number; onClose: () => void }) {
  const d = useQuery<CompanyCard>(id ? companyCardKey(id) : null);
  const [drafted, markDrafted] = useDayMarks("companyDrafted");
  const [claude, setClaude] = useState<ClaudeMode | null>(null);
  const { quickByKind } = useRegistry();

  const ask = () => {
    if (!v) return;
    if (drafted.has(v.c.id)) return toast(m.overlay.draftPending);
    askCompanyDraft(v.c).then(() => markDrafted(v.c.id)).catch(() => {});
  };
  const site = v?.c.website ? siteLabel(v.c.website) : null;
  const sub = v ? [v.c.sector_path, v.c.city].filter(Boolean).join(m.sep) : "";

  return (
    <ExpandOverlay
      open={!!id && !!v}
      from={from}
      title={v?.c.name ?? kit.nouns.company}
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
              {site ? <>{sub ? m.sep : ""}<a href={webUrl(v.c.website!)} target="_blank" rel="noreferrer" className="text-text-soft">{site}</a></> : null}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {quickByKind.has("person") ? <button type="button" className="co-btn" onClick={() => openSheet("person", { company_id: v.c.id })}>{m.overlay.addPerson}</button> : null}
            <button type="button" className="ppl-ask" onClick={ask}>
              <BoardIcon name="pen" className="size-icon-chip" />
              {drafted.has(v.c.id) ? m.overlay.draftAsked : m.overlay.askDraft}
            </button>
            <HeaderMenu v={v} onClaude={() => setClaude({ id: v.c.id, replyTo: null })} onClose={onClose} />
            <button type="button" className="ppl-round" data-close aria-label={kit.close} onClick={onClose}>
              <BoardIcon name="close" className="size-icon-md" stroke={STROKE.close} />
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
