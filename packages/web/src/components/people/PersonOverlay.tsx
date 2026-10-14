import { useMemo, useState } from "react";
import { Link } from "wouter";
import { remove } from "../../api/actions";
import { cardKey } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { Person, PersonCard } from "../../api/types";
import { PATHS, timelinePath } from "../../app/routes";
import { openSheet } from "../../app/ui";
import { askDraft, defaultChannel, STATUS_LABEL, statusOf, useDayMarks } from "../../lib/people";
import { usePopover } from "../../lib/usePopover";
import { BoardIcon } from "../boardIcons";
import { ExpandOverlay } from "../ExpandOverlay";
import { toast } from "../toast";
import { Avatar, ErrorBox, Skeleton } from "../ui";
import { Composer, type Mode } from "./Composer";
import { PersonAside } from "./PersonAside";
import { PersonExtras } from "./PersonExtras";
import { Stream } from "./Stream";
import { buildStream, type StreamFilter } from "./streamItems";

/** Menu of the header: the things the board leaves out (forms for touch and draft, editing the accounts, delete, timeline) */
function HeaderMenu({ p, onClose }: { p: Person; onClose: () => void }) {
  const { open, setOpen, root } = usePopover();
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-round" aria-label="Diğer işlemler" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={2.4} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop" inert={!open}>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("touch", { person_id: p.id }))}>Temas ekle</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("draft", { person_id: p.id, channel: p.awaiting?.channel ?? p.last_channel ?? defaultChannel(p) }))}>Taslak yaz</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("person", { person_id: p.id }))}>Düzenle, hesaplar</button>
        <Link href={timelinePath("person", p.id)} role="menuitem" className="ppl-pop-item">Tüm zaman çizelgesi</Link>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/people/${p.id}`, p.name).then(onClose).catch(() => {}))}>Sil</button>
      </div>
    </div>
  );
}

/** Both columns of the overlay once the card is loaded; the stream filter, the channel filter and the composer mode live here */
function Body({ p, card }: { p: Person; card?: PersonCard }) {
  const [filter, setFilter] = useState<StreamFilter>("all");
  const [chan, setChan] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("touch");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const items = useMemo(() => (card ? buildStream(card) : []), [card]);
  const row = card?.row ?? p;
  const status = statusOf(row);
  const changeMode = (m: Mode) => { setMode(m); if (m !== "claude") setReplyTo(null); };

  return (
    <>
      <div className="ppl-col">
        <PersonAside p={row} card={card} chan={chan} onChan={setChan} />
        {card ? <PersonExtras card={card} /> : null}
      </div>
      <div className="ppl-col min-w-0">
        <Composer person={row} mode={mode} onMode={changeMode} replyTo={replyTo} onSent={() => setReplyTo(null)} />
        {card ? (
          <Stream items={items} person={row} status={status} filter={filter} onFilter={setFilter} chan={chan}
            onAnswer={() => setMode("touch")} onReply={(thread) => { setMode("claude"); setReplyTo(thread); }} />
        ) : <Skeleton className="h-chart-height" />}
      </div>
    </>
  );
}

/** A person as the board's dialog: grows from the clicked row or card, header with the actions, rhythm and facts on the left, composer and stream on the right */
export function PersonOverlay({ id, from, p, onClose }: { id: number | null; from: DOMRect | null; p: Person | undefined; onClose: () => void }) {
  const d = useQuery<PersonCard>(id ? cardKey(id) : null);
  const [drafted, markDrafted] = useDayMarks("drafted");
  const row = d.data?.row ?? p;
  const s = row ? statusOf(row) : "ok";

  const ask = () => {
    if (!row) return;
    if (drafted.has(row.id)) return toast("Taslak zaten yazılıyor");
    askDraft(row).then(() => markDrafted(row.id)).catch(() => {});
  };

  return (
    <ExpandOverlay
      open={!!id && !!row}
      from={from}
      title={row?.name ?? "Kişi"}
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
              {row.company_id ? <>{row.role ? " · " : ""}<Link href={`${PATHS.companies}/${row.company_id}`} className="text-text-soft">{row.company_name}</Link></> : null}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="ppl-ask" onClick={ask}>
              <BoardIcon name="pen" className="size-icon-chip" />
              {drafted.has(row.id) ? "Taslak istendi" : "Claude’dan taslak iste"}
            </button>
            <HeaderMenu p={row} onClose={onClose} />
            <button type="button" className="ppl-round" data-close aria-label="Kapat" onClick={onClose}>
              <BoardIcon name="close" className="size-icon-md" stroke={2} />
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
