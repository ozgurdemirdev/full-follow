import { useEffect, useState } from "react";
import type { ChatMeta } from "../api";
import { T } from "../messages";
import { Icon } from "@kit/components/icons";

interface Props {
  /** session title; "" before the first message creates the chat */
  title: string;
  titleKey: number | null;
  model: string;
  effort: string;
  meta: ChatMeta | null;
  fullAccess: boolean;
  large: boolean;
  popOpen: boolean;
  onTitle: (title: string) => void;
  onToggleSessions: () => void;
  onTogglePop: () => void;
  onToggleLarge: () => void;
  onMinimize: () => void;
}

export function ChatHeader({ title, titleKey, model, effort, meta, fullAccess, large, popOpen, onTitle, onToggleSessions, onTogglePop, onToggleLarge, onMinimize }: Props) {
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title, titleKey]);
  const commit = () => {
    const v = draft.trim();
    if (!v) setDraft(title);
    else if (v !== title) onTitle(v);
  };
  const modelLabel = meta?.models.find((m) => m.id === model)?.label ?? model;
  const effortLabel = meta?.efforts.find((e) => e.id === effort)?.label ?? effort;
  return (
    <header className="ch">
      <button className="ib ib-hist" type="button" aria-label={T.sessions} onClick={onToggleSessions}>
        <Icon name="hist" className="size-icon-md" />
      </button>
      <input
        className="ttl"
        value={draft}
        aria-label={T.titleLabel}
        spellCheck={false}
        placeholder={T.newChatTitle}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            setDraft(title);
            e.currentTarget.blur();
          }
        }}
      />
      {fullAccess && <span className="fullmark" role="note" title={T.fullAccessMarkHint} aria-label={T.fullAccessMarkHint}>{T.fullAccessMark}</span>}
      <button className="mchip" type="button" aria-expanded={popOpen} aria-haspopup="dialog" onClick={onTogglePop}>
        <span>{modelLabel} · {effortLabel}</span>
        <Icon name="down" className="size-icon-sm" />
      </button>
      <button className="ib ib-expand" type="button" aria-label={large ? T.shrink : T.expand} onClick={onToggleLarge}>
        <Icon name={large ? "shrink" : "expand"} className="size-icon-md" />
      </button>
      <button className="ib" type="button" aria-label={T.minimize} onClick={onMinimize}>
        <Icon name="down" className="size-icon-md" />
      </button>
    </header>
  );
}
