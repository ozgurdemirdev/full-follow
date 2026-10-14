import { Link } from "wouter";
import { remove } from "../../api/actions";
import type { Idea } from "../../api/types";
import { PATHS } from "../../app/routes";
import { openSheet } from "../../app/ui";
import { usePopover } from "../../lib/usePopover";
import { BoardIcon } from "../boardIcons";

/** Menu of the detail header: what the board leaves out (sectors, parent idea, edit, touch and post forms, delete) */
export function IdeaMenu({ idea }: { idea: Idea }) {
  const { open, setOpen, root } = usePopover();
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative flex-none">
      <button type="button" className="ppl-round" aria-label="Diğer işlemler" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={2.4} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop ideas-pop" inert={!open}>
        {idea.sectors.length ? <span className="ideas-pop-note">Sektör: {idea.sectors.map((s) => s.path).join(", ")}</span> : null}
        {idea.parent_id ? (
          <Link href={`${PATHS.ideas}/${idea.parent_id}`} role="menuitem" className="ppl-pop-item" onClick={() => setOpen(false)}>
            <span>Üst fikir: {idea.parent_title}</span>
          </Link>
        ) : null}
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("idea", { idea_id: idea.id }))}>Düzenle</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("touch", { idea_id: idea.id }))}>Anlattığım teması ekle</button>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("post", { idea_id: idea.id }))}>Paylaşım ekle</button>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/ideas/${idea.id}`, `“${idea.title}” fikri`).catch(() => {}))}>Sil</button>
      </div>
    </div>
  );
}
