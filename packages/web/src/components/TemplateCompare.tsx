import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";
import type { TemplateGroup, TemplateRank, TemplateSectorStat } from "../api/types";
import { pct } from "../lib/format";
import { TEMPLATE_KIND } from "../lib/labels";
import { dur, ease } from "../lib/motion";
import { channelName } from "../lib/network";
import { Icon } from "./icons";
import { MotionScope } from "./MotionScope";
import { CardHead, Chip, Empty, order } from "./ui";

/** Reply rate with a thin bar; early rows use the muted bar */
function RateBar({ rate, early, leader }: { rate: number | null; early: boolean; leader?: boolean }) {
  return (
    <div className="flex min-w-0 flex-grow items-center gap-4">
      <div className="track flex-grow">
        <i className={`grow-x ${early ? "bg-accent-neutral" : leader ? "bg-primary" : "bg-accent-opportunity"}`} style={{ width: `${(rate ?? 0) * 100}%` }} />
      </div>
      <span className="w-control-height-md flex-none text-right font-mono text-sm">{pct(rate)}</span>
    </div>
  );
}

const Counts = ({ s }: { s: { sent: number; replied: number } }) => (
  <span className="flex-none font-mono text-sm text-text-secondary">{s.replied}/{s.sent}</span>
);

function SectorRows({ list }: { list: TemplateSectorStat[] }) {
  return (
    <div className="flex flex-col gap-3 bg-surface-inset px-9 py-5">
      {list.map((s) => (
        <div key={s.sector_path} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-base-sm">
          <span className="min-w-0 flex-grow basis-full truncate desk:basis-0">{s.sector_path}</span>
          <div className="flex min-w-0 flex-grow items-center gap-5">
            <RateBar rate={s.reply_rate} early={s.early} />
            <Counts s={s} />
            {s.early ? <Chip>erken</Chip> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateRow({ t }: { t: TemplateRank }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="row">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-x-5 gap-y-3 border-0 bg-transparent px-9 py-5 text-left text-base text-text-primary">
        <Icon name="chevron" className={`size-icon-sm flex-none transition-transform dur-fade ${open ? "rotate-90" : ""}`} stroke={1.8} />
        <span className="min-w-0 flex-grow basis-0 truncate">{t.name}</span>
        {t.leader ? <Chip tone="success">önde</Chip> : null}
        {t.early ? <Chip>erken</Chip> : null}
        <div className="flex min-w-0 flex-grow basis-full items-center gap-5 desk:basis-0">
          <RateBar rate={t.reply_rate} early={t.early} leader={t.leader} />
          <Counts s={t} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: dur.sidebar, ease: ease.out }}
            className="overflow-hidden"
          >
            <SectorRows list={t.sectors} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Report section: templates of the same kind and channel side by side (sent, replies, rate), expandable to the sector breakdown */
export function TemplateCompare({ groups }: { groups: TemplateGroup[] }) {
  return (
    <MotionScope>
      <section className="card rise overflow-hidden" style={order(5)} aria-label="Şablon kıyası">
        <CardHead title="Şablon kıyası">
          <span className="text-sm text-text-secondary">cevap gelen / gönderilen</span>
        </CardHead>
        {groups.length ? groups.map((g) => (
          <div key={`${g.kind}/${g.channel}`} className="border-b border-border-subtle last:border-b-0">
            <h3 className="m-0 px-9 pb-1 pt-6 text-sm font-medium text-text-secondary">
              {TEMPLATE_KIND[g.kind] ?? g.kind} · {g.channel ? channelName(g.channel) : "Tüm kanallar"}
            </h3>
            {g.templates.map((t) => <TemplateRow key={t.id} t={t} />)}
          </div>
        )) : <Empty>Henüz gönderilen şablonlu mesaj yok.</Empty>}
        <p className="m-0 px-9 py-5 text-sm text-text-muted">Gönderimi az olan şablon “erken” sayılır, oranı henüz güvenilir değil. “Önde”: aynı tür ve kanalda, yeterli örneği olan en az iki şablon arasında en yüksek cevap oranı.</p>
      </section>
    </MotionScope>
  );
}
