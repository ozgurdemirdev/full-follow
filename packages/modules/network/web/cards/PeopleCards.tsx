import { run } from "@kit/api/actions";
import type { List, Person } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { useRegistry } from "@kit/app/modules/registry";
import { PATHS } from "@kit/app/routes";
import { SHOWN, isCold } from "@kit/lib/dashboard";
import { initials, todayIso } from "@kit/lib/format";
import { channelName } from "@kit/lib/network";
import { BoardIcon } from "@kit/components/boardIcons";
import { Card } from "@kit/components/ui";
import { useExpand } from "@kit/components/ExpandOverlay";
import { DashOverlay, type ExRow } from "@kit/components/dash/DashOverlay";

const daysText = (n: number) => (n === 0 ? "bugün" : `${n} gün`);

/** "Cevap bekleyenler": people who got a message and have not answered; the longest wait that is late stands out */
export function AwaitingCard({ list, waitDays }: { list: List<Person>; waitDays: number }) {
  const ex = useExpand();
  const reg = useRegistry();
  const personHref = (p: Person) => reg.link("person", p.id) ?? PATHS.today;
  const hi = list.rows[0]?.awaiting?.late ? list.rows[0].id : null;
  const rows: ExRow[] = list.rows.map((p) => ({
    key: p.id, lead: initials(p.name), title: p.name, sub: [p.company_name, channelName(p.awaiting?.channel)].filter(Boolean).join(" · "),
    right: daysText(p.awaiting?.days ?? 0), rightCls: p.awaiting?.late ? "text-danger-soft" : undefined,
    tag: p.awaiting?.late ? "Takip zamanı" : "Bekliyor", dot: p.awaiting?.late ? "bg-danger" : "bg-entity-later", href: personHref(p),
  }));
  const avg = list.rows.length ? list.rows.reduce((s, p) => s + (p.awaiting?.days ?? 0), 0) / list.rows.length : 0;

  return (
    <>
      <Card title="Cevap bekleyenler" count={`${list.total} kişi`} onExpand={(r) => ex.show("awaiting", r)} className="dash-gap-6 rise">
        {list.rows.length === 0 ? <p className="m-0 text-base-sm text-text-muted">Cevap beklenen mesaj yok. Yeni kişilere yazma zamanı.</p> : null}
        <div className="flex flex-col gap-1">
          {list.rows.slice(0, SHOWN.awaiting).map((p) => {
            const on = p.id === hi;
            return (
              <RecordLink key={p.id} type="person" id={p.id} className={`dash-row flex items-center gap-5 rounded-inner-lg p-5 ${on ? "bg-accent text-accent-on hover:text-accent-on" : "text-text-primary hover:text-text-primary"}`}>
                <span className={`dash-av size-avatar-tile text-base-sm ${on ? "bg-accent-on text-accent" : ""}`}>{initials(p.name)}</span>
                <span className="flex min-w-0 flex-grow flex-col">
                  <span className="truncate text-base font-medium">{p.name}</span>
                  <span className={`truncate text-sm ${on ? "text-accent-on-soft" : "text-text-secondary"}`}>{p.company_name ?? p.sector_path ?? ""}</span>
                </span>
                <span className="flex flex-none flex-col items-end">
                  <span className="font-mono text-base-sm font-medium">{daysText(p.awaiting?.days ?? 0)}</span>
                  <span className={`text-sm ${on ? "text-accent-on-soft" : "text-text-secondary"}`}>{channelName(p.awaiting?.channel)}</span>
                </span>
              </RecordLink>
            );
          })}
        </div>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Cevap bekleyenler", sub: `${list.total} kişiden cevap bekleniyor · ${waitDays} gün geçenler öne çıkar`, page: "Kişiler", href: reg.pagePath("people") ?? PATHS.today, foot: `Ortalama bekleme ${avg.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} gün`, rows }} />
    </>
  );
}

/** "Soğuyan bağlantılar": people silent for the cooling limit, and one request for Claude to write them a hello */
export function CoolingCard({ list, coolingDays }: { list: List<Person>; coolingDays: number }) {
  const ex = useExpand();
  const reg = useRegistry();
  const personHref = (p: Person) => reg.link("person", p.id) ?? PATHS.today;
  const shown = list.rows.slice(0, SHOWN.cooling);
  const rows: ExRow[] = list.rows.map((p) => {
    const cold = isCold(p, coolingDays);
    return {
      key: p.id, lead: initials(p.name), title: p.name, sub: [p.company_name, p.last_channel ? `son ${channelName(p.last_channel)}` : ""].filter(Boolean).join(" · "),
      right: `${p.days_since} gün`, tag: cold ? "Soğuk" : "Soğuyor", dot: "bg-entity-opportunity", href: personHref(p),
    };
  });
  const ask = () =>
    run("post", "/tasks", { title: `Soğuyan bağlantılar için selam taslağı hazırla: ${shown.map((p) => p.name).join(", ")}`, assignee: "claude", due_date: todayIso() }, { ok: "Claude’a görev verildi, taslak onayına düşecek" }).catch(() => {});

  return (
    <>
      <Card title="Soğuyan bağlantılar" count={`${list.total} kişi`} onExpand={(r) => ex.show("cooling", r)} className="dash-gap-4 dash-head-pad rise">
        {list.rows.length === 0 ? <p className="m-0 text-base-sm text-text-muted">Soğuyan bağlantı yok.</p> : null}
        {shown.map((p) => (
          <RecordLink key={p.id} type="person" id={p.id} className="dash-row flex items-center gap-5 border-t border-border-subtle py-4 text-text-primary hover:text-text-primary">
            <span className="dash-av size-avatar-list text-sm">{initials(p.name)}</span>
            <span className="flex min-w-0 flex-grow flex-col">
              <span className="truncate text-base">{p.name}</span>
              <span className="truncate text-sm text-text-secondary">{p.company_name ?? p.sector_path ?? ""}</span>
            </span>
            <span className="flex flex-none flex-col items-end">
              <span className="font-mono text-base-sm">{p.days_since} gün</span>
              <span className="text-sm text-text-secondary">{p.last_channel ? `son ${channelName(p.last_channel)}` : ""}</span>
            </span>
          </RecordLink>
        ))}
        {shown.length ? (
          <button type="button" className="dash-btn is-claude mt-auto" onClick={ask}>
            <BoardIcon name="sparkle" className="size-icon-chip" />
            Claude selam taslağı yazsın
          </button>
        ) : null}
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Soğuyan bağlantılar", sub: `${coolingDays} günden uzun süredir sessiz`, page: "Kişiler", href: reg.pagePath("people") ?? PATHS.today, foot: "Claude her biri için selam taslağı yazabilir", rows }} />
    </>
  );
}
