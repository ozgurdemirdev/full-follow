import { Link } from "wouter";
import { remove } from "@kit/api/actions";
import type { Idea } from "@kit/api/types";
import { m } from "../messages";
import { IDEAS_PATH } from "../paths";
import { openSheet } from "@kit/app/ui";
import { usePopover } from "@kit/lib/usePopover";
import { BoardIcon } from "@kit/components/boardIcons";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Menu of the detail header: what the board leaves out (sectors, parent idea, edit, touch and post forms, delete) */
export function IdeaMenu({ idea }: { idea: Idea }) {
  const { open, setOpen, root } = usePopover();
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative flex-none">
      <button type="button" className="ppl-round" aria-label={kit.recordActions.moreActions} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={STROKE.bold} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop ideas-pop" inert={!open}>
        {idea.sectors.length ? <span className="ideas-pop-note">{m.menu.sectors(idea.sectors.map((s) => s.path).join(", "))}</span> : null}
        {idea.parent_id ? (
          <Link href={`${IDEAS_PATH}/${idea.parent_id}`} role="menuitem" className="ppl-pop-item" onClick={() => setOpen(false)}>
            <span>{m.menu.parent(idea.parent_title ?? "")}</span>
          </Link>
        ) : null}
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("idea", { idea_id: idea.id }))}>{kit.edit}</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("touch", { idea_id: idea.id }))}>{m.menu.addTouch}</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("post", { idea_id: idea.id }))}>{m.menu.addPost}</button>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/ideas/${idea.id}`, m.menu.deleteNoun(idea.title)).catch(() => {}))}>{kit.delete}</button>
      </div>
    </div>
  );
}
