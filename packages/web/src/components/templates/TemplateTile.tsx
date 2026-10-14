import { memo, useMemo } from "react";
import type { Template } from "../../api/types";
import { pct } from "../../lib/format";
import { TEMPLATE_KIND } from "../../lib/labels";
import { flagOf, meta, openSegments, rateTone, TONE_BAR, TONE_TEXT } from "../../lib/templates";
import { Meter } from "../ui";

/** One template of the list: kind, channel and sector, the text with its placeholders marked, the reply rate as a meter */
export const TemplateTile = memo(function TemplateTile({ t, onOpen }: { t: Template; onOpen: (id: number, from: DOMRect) => void }) {
  const tone = rateTone(t.reply_rate);
  const flag = flagOf(t);
  const parts = useMemo(() => openSegments(t.body), [t.body]);
  return (
    <article className="tpl-tile" data-record={`template-${t.id}`}>
      <button type="button" className="tpl-open" aria-label={`${t.name} şablonunu aç`} onClick={(e) => onOpen(t.id, e.currentTarget.closest("article")!.getBoundingClientRect())}>
        <span className="tpl-head">
          <span className="tpl-kind">{TEMPLATE_KIND[t.kind]}</span>
          <span className="tpl-meta">{meta(t)}</span>
          <span className="flex-grow" />
          {flag ? <span className={flag.retire ? "tpl-flag" : "tpl-meta"}>{flag.text}</span> : null}
        </span>
        <span className="tpl-title">{t.name}</span>
        <span className="tpl-text">
          {parts.map((s, i) => <span key={i} className={s.kind === "open" ? "text-warning" : undefined}>{s.text}</span>)}
        </span>
        <span className="tpl-rate">
          <Meter size="sm" value={(t.reply_rate ?? 0) * 100} color={TONE_BAR[tone]} label={`${t.name} cevap oranı`} />
          <span className={`tpl-pct ${TONE_TEXT[tone]}`}>{t.reply_rate === null ? "ölçüm yok" : `${pct(t.reply_rate)} cevap`}</span>
        </span>
        <span className="tpl-meta">{t.used ? `${t.used} kez kullanıldı · ${t.replied} cevap` : "Henüz kullanılmadı"}</span>
      </button>
    </article>
  );
});
