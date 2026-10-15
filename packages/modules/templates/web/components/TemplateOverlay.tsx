import { useMemo, useState } from "react";
import { remove, run } from "@kit/api/actions";
import type { Person, Template } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { pct } from "@kit/lib/format";
import { TEMPLATE_KIND } from "@kit/lib/labels";
import { defaultChannel } from "@kit/lib/people";
import { m } from "../messages";
import { filledSegments, meta, openSegments, rateTone, recipients, TONE_TEXT, useRendered } from "../templates";
import { usePopover } from "@kit/lib/usePopover";
import { BoardIcon } from "@kit/components/boardIcons";
import { ExpandOverlay } from "@kit/components/ExpandOverlay";
import { toast } from "@kit/components/toast";

/** Menu of the header: what the board leaves out (edit, a draft for someone else through the form, delete) */
function HeaderMenu({ t, onClose }: { t: Template; onClose: () => void }) {
  const { open, setOpen, root } = usePopover();
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-round" aria-label={m.shared.moreActions} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={2.4} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop" inert={!open}>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("template", { template_id: t.id }))}>{m.shared.edit}</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("draft", { template_id: t.id, channel: t.channel ?? undefined }))}>{m.overlay.draftForOther}</button>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/templates/${t.id}`, m.overlay.deleteNoun(t.name)).then(onClose).catch(() => {}))}>{m.shared.delete}</button>
      </div>
    </div>
  );
}

/** Both columns: recipient pills and the text on the left, the numbers and the tip on the right */
function Body({ t, people }: { t: Template; people: Person[] }) {
  const [who, setWho] = useState<Person | null>(null);
  const picks = useMemo(() => recipients(people), [people]);
  const rendered = useRendered(t.id, who?.id ?? null);
  const parts = useMemo(() => (rendered === null ? openSegments(t.body) : filledSegments(t.body, rendered)), [t.body, rendered]);
  const text = rendered ?? t.body;
  const tone = rateTone(t.reply_rate);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => toast(m.overlay.copied), () => toast(m.overlay.copyFailed, "error"));
  };
  const useIt = () => {
    if (!who) return toast(m.overlay.pickRecipient);
    run("post", "/drafts", { person_id: who.id, channel: t.channel ?? defaultChannel(who), template_id: t.id }, { ok: m.overlay.draftCreated(who.name) })
      .catch(() => {});
  };

  return (
    <>
      <div className="tpl-col">
        <div className="tpl-who">
          <span className="tpl-who-label">{m.overlay.to}</span>
          {picks.map((p) => (
            <button key={p.id} type="button" className="tpl-pill" aria-pressed={who?.id === p.id} onClick={() => setWho(p)}>{p.name}</button>
          ))}
          <button type="button" className="tpl-pill" aria-pressed={!who} onClick={() => setWho(null)}>{m.overlay.blank}</button>
        </div>
        <p className="tpl-body-text" aria-live="polite">
          {parts.map((s, i) => <span key={i} className={s.kind === "plain" ? undefined : s.kind === "filled" ? "tpl-filled" : "tpl-open-ph"}>{s.text}</span>)}
        </p>
        <div className="tpl-acts">
          <button type="button" className="tpl-copy" onClick={copy}>{m.shared.copy}</button>
          <button type="button" className="tpl-use" onClick={useIt}>
            {m.overlay.useAsDraft}
            <span><BoardIcon name="arrowRight" className="size-icon-xs" stroke={2.4} /></span>
          </button>
        </div>
      </div>
      <div className="tpl-col tpl-side">
        <div className="tpl-stats">
          <div><span>{m.overlay.used}</span><span>{t.used}</span></div>
          <div><span>{m.overlay.replied}</span><span>{t.replied}</span></div>
          <div><span>{m.overlay.rate}</span><span className={TONE_TEXT[tone]}>{t.reply_rate === null ? "–" : pct(t.reply_rate)}</span></div>
        </div>
        {t.tip ? <p className="tpl-tip"><i /><span>{t.tip}</span></p> : null}
      </div>
    </>
  );
}

/** A template as the board's dialog: grows from its tile; recipient pills fill the placeholders live */
export function TemplateOverlay({ t, from, people, onClose }: { t: Template | undefined; from: DOMRect | null; people: Person[]; onClose: () => void }) {
  return (
    <ExpandOverlay
      open={!!t}
      from={from}
      title={t?.name ?? m.overlay.fallbackTitle}
      onClose={onClose}
      bodyClassName="tpl-dialog"
      header={t ? (
        <>
          <div className="tpl-dhead">
            <span>{TEMPLATE_KIND[t.kind]} · {meta(t)}</span>
            <h2>{t.name}</h2>
          </div>
          <div className="flex gap-3">
            <HeaderMenu t={t} onClose={onClose} />
            <button type="button" className="ppl-round" data-close aria-label={m.shared.close} onClick={onClose}>
              <BoardIcon name="close" className="size-icon-md" stroke={2} />
            </button>
          </div>
        </>
      ) : null}
    >
      {t ? <Body key={t.id} t={t} people={people} /> : null}
    </ExpandOverlay>
  );
}
