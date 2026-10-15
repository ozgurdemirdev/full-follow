import { useState } from "react";
import { remove } from "@kit/api/actions";
import { cardKey } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Person, PersonCard } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { useRegistry } from "@kit/app/modules/registry";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { askDraft, defaultChannel, statusOf, useDayMarks } from "@kit/lib/people";
import { useTasksOn } from "@kit/lib/taskAccess";
import { STATUS_LABEL } from "../people";
import { usePopover } from "@kit/lib/usePopover";
import { BoardIcon } from "@kit/components/boardIcons";
import { ExpandOverlay } from "@kit/components/ExpandOverlay";
import { toast } from "@kit/components/toast";
import { Avatar, ErrorBox } from "@kit/components/ui";
import { PersonAside } from "./PersonAside";
import { m as kit } from "@kit/messages";

import { m } from "../messages";
import { PersonExtras } from "./PersonExtras";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Menu of the header: the things the board leaves out (forms for touch and draft, editing the accounts, delete, timeline) */
function HeaderMenu({ p, onClose }: { p: Person; onClose: () => void }) {
  const { open, setOpen, root } = usePopover();
  const { quickByKind } = useRegistry();
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-round" aria-label={m.overlay.moreActions} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={STROKE.bold} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop" inert={!open}>
        {quickByKind.has("touch") ? <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("touch", { person_id: p.id }))}>{m.actions.addTouch}</button> : null}
        {quickByKind.has("draft") ? <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("draft", { person_id: p.id, channel: p.awaiting?.channel ?? p.last_channel ?? defaultChannel(p) }))}>{m.actions.writeDraft}</button> : null}
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("person", { person_id: p.id }))}>{m.overlay.editAccounts}</button>
        <Slot name="person.overlay.menu" props={{ type: "person", id: p.id, role: "menuitem", className: "ppl-pop-item", label: m.timelineLink }} />
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/people/${p.id}`, p.name).then(onClose).catch(() => {}))}>{kit.delete}</button>
      </div>
    </div>
  );
}

/** Both columns of the overlay once the card is loaded; the channel filter of the stream is picked in the left column, so it lives here */
function Body({ p, card }: { p: Person; card?: PersonCard }) {
  const [chan, setChan] = useState<string | null>(null);
  const row = card?.row ?? p;

  return (
    <>
      <div className="ppl-col">
        <PersonAside p={row} card={card} chan={chan} onChan={setChan} />
        {card ? <PersonExtras card={card} /> : null}
      </div>
      <Slot name="person.overlay.main" props={{ person: row, card, chan }} />
    </>
  );
}

/** A person as the board's dialog: grows from the clicked row or card, header with the actions, rhythm and facts on the left, composer and stream on the right */
export function PersonOverlay({ id, from, p, onClose }: { id: number | null; from: DOMRect | null; p: Person | undefined; onClose: () => void }) {
  const d = useQuery<PersonCard>(id ? cardKey(id) : null);
  const [drafted, markDrafted] = useDayMarks("drafted");
  const tasksOn = useTasksOn();
  const row = d.data?.row ?? p;
  const s = row ? statusOf(row) : "ok";

  const ask = () => {
    if (!row) return;
    if (drafted.has(row.id)) return toast(m.actions.draftPending);
    askDraft(row).then(() => markDrafted(row.id)).catch(() => {});
  };

  return (
    <ExpandOverlay
      open={!!id && !!row}
      from={from}
      title={row?.name ?? kit.nouns.person}
      onClose={onClose}
      bodyClassName="ppl-body"
      header={row ? (
        <>
          <Avatar name={row.name} id={row.id} size="hero" />
          <div className="flex min-w-0 flex-grow flex-col gap-1">
            <div className="flex flex-wrap items-center gap-4">
              <h2>{row.name}</h2>
              {s !== "ok" ? <span className="ppl-hchip" data-s={s}>{STATUS_LABEL[s]}</span> : null}
            </div>
            <span className="text-base text-text-secondary">
              {row.role}
              {row.company_id ? <>{row.role ? m.sep : ""}<RecordLink type="company" id={row.company_id} className="text-text-soft">{row.company_name}</RecordLink></> : null}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {tasksOn ? (
              <button type="button" className="ppl-ask" onClick={ask}>
                <BoardIcon name="pen" className="size-icon-chip" />
                {drafted.has(row.id) ? m.actions.draftAsked : m.actions.askDraft}
              </button>
            ) : null}
            <HeaderMenu p={row} onClose={onClose} />
            <button type="button" className="ppl-round" data-close aria-label={kit.close} onClick={onClose}>
              <BoardIcon name="close" className="size-icon-md" stroke={STROKE.regular} />
            </button>
          </div>
        </>
      ) : null}
    >
      {row ? (
        d.error && !d.data ? <ErrorBox error={d.error} retry={d.reload} /> : <Body key={row.id} p={row} card={d.data} />
      ) : null}
    </ExpandOverlay>
  );
}
