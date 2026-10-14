import { useRef, type CSSProperties, type ReactNode } from "react";
import type { ApiError } from "../api/client";
import { useTags } from "../api/keys";
import { initials } from "../lib/format";
import { ACTOR, CONTACT_STATUS, STATUS_TONE, TAG_CLS, TONE_CLS, WHO_CLS, type Actor, type Tone } from "../lib/labels";
import { BoardIcon } from "./boardIcons";

export function Chip({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`chip ${TONE_CLS[tone]} ${className}`}>{children}</span>;
}

export function Who({ actor, children, className = "" }: { actor: Actor; children?: ReactNode; className?: string }) {
  return <span className={`who ${WHO_CLS[actor]} ${className}`}>{children ?? ACTOR[actor]}</span>;
}

/** Etiket çipleri (id → ad ve renk, etiket listesinden); silinen etiket soluk görünür ama kayıtta kalır */
export function Tags({ ids }: { ids: readonly number[] }) {
  const tags = useTags();
  return (
    <>
      {ids.map((id) => {
        const t = tags.byId.get(id);
        if (!t) return null;
        return (
          <span key={id} className={`chip ${TAG_CLS[t.color] ?? TONE_CLS.neutral} ${t.deleted_at ? "opacity-muted" : ""}`} title={t.deleted_at ? "Silinmiş etiket" : undefined}>
            {t.name}
          </span>
        );
      })}
    </>
  );
}

/** Temas durumu çipi: Yazılmadı, Yazıldı, Cevap geldi, Görüşüldü, Olumsuz */
export function StatusChip({ status }: { status: string }) {
  return <Chip tone={STATUS_TONE[status] ?? "neutral"}>{CONTACT_STATUS[status] ?? status}</Chip>;
}

const AV = {
  sm: "size-avatar-sm text-base-sm",
  md: "size-avatar-md text-base-sm",
  list: "size-avatar-list text-base-sm",
  row: "size-avatar-row text-sm",
  tile: "size-avatar-tile text-base-sm",
  lg: "size-avatar-lg text-md",
  xl: "size-avatar-xl text-lg",
  hero: "size-avatar-hero text-xl",
};
const AVATAR_COLORS = 5;
const hashName = (s: string) => [...s].reduce((h, c) => h + c.charCodeAt(0), 0);
/** Initials on one of the five avatar colour pairs: picked by record id, by name when there is no id */
export const avatarPair = (name: string, id?: number) => `avatar-${((id ?? hashName(name)) % AVATAR_COLORS) + 1}`;
export function Avatar({ name, size = "md", id, className = "" }: { name: string; size?: keyof typeof AV; id?: number; className?: string }) {
  return <span className={`avatar ${avatarPair(name, id)} ${AV[size]} ${className}`} aria-hidden="true">{initials(name)}</span>;
}

/** Kademeli giriş animasyonu için sıra numarası */
export const order = (i: number): CSSProperties => ({ ["--i" as string]: Math.min(i, 12) });

export interface PillItem {
  label: ReactNode;
  /** small mono count after the label */
  count?: number | string;
  /** background class of a leading dot */
  dot?: string;
}

/** Pill row of the boards: light fill with dark ink on the active one; scrolls sideways when it does not fit, never wraps */
function Pills({ role, items, isOn, onPick, label, size }: {
  role: "tablist" | "radiogroup";
  items: PillItem[];
  isOn: (i: number) => boolean;
  onPick: (i: number) => void;
  label?: string;
  size?: "md" | "lg";
}) {
  const tab = role === "tablist";
  return (
    <div className="ff-seg" role={role} aria-label={label} data-size={size}>
      {items.map((it, i) => (
        <button
          key={i}
          type="button"
          role={tab ? "tab" : "radio"}
          {...(tab ? { "aria-selected": isOn(i) } : { "aria-checked": isOn(i) })}
          onClick={() => onPick(i)}
        >
          {it.dot ? <span className={`ff-seg-dot ${it.dot}`} /> : null}
          {it.label}
          {it.count !== undefined ? <span className="ff-seg-count">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Single choice by value (a radio group of pills) */
export function Filters<T extends string | number>({
  items, value, onChange, label, size,
}: { items: (PillItem & { value: T })[]; value: T; onChange: (v: T) => void; label?: string; size?: "md" | "lg" }) {
  return <Pills role="radiogroup" items={items} isOn={(i) => items[i].value === value} onPick={(i) => onChange(items[i].value)} label={label} size={size} />;
}

/** Tabs by index (a tablist of pills) */
export function Segmented({
  items, value, onChange, label, size,
}: { items: (string | PillItem)[]; value: number; onChange: (i: number) => void; label: string; size?: "md" | "lg" }) {
  return <Pills role="tablist" items={items.map((x) => (typeof x === "string" ? { label: x } : x))} isOn={(i) => i === value} onPick={onChange} label={label} size={size} />;
}

/** Page title with a subtitle line (the menu lives in the shell) */
export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ff-headtext">
      <h1 className="page-title">{title}</h1>
      {sub ? <div className="ff-sub">{sub}</div> : null}
      {children}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-9" aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="h-chart-height-mobile" />
      <Skeleton className="h-chart-height" />
    </div>
  );
}

export function ErrorBox({ error, retry }: { error?: ApiError | Error; retry?: () => void }) {
  if (!error) return null;
  return (
    <div className="card flex flex-wrap items-center gap-5 p-9 text-base text-danger" role="alert">
      <span className="flex-grow">{error.message || "Yüklenemedi"}</span>
      {retry ? <button type="button" className="btn btn-sec" onClick={retry}>Tekrar dene</button> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Kart başlığı */
export function CardHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card-head">
      <h2 className="card-title">{title}</h2>
      {children}
    </div>
  );
}

/** Board card: header row with the title, optional actions and a count pill that grows the card into the expand overlay */
export function Card({ title, label, count, onExpand, actions, children, className = "", style }: {
  title?: string;
  /** accessible name when the card draws its own header instead of `title` */
  label?: string;
  /** text of the count pill (for example "6 iş"); shown when onExpand is given */
  count?: ReactNode;
  /** gets the rect of the card to grow the overlay from */
  onExpand?: (from: DOMRect) => void;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const root = useRef<HTMLElement>(null);
  return (
    <section ref={root} aria-label={title ?? label} className={`ff-card ${className}`} style={style}>
      {title ? (
        <div className="ff-card-head">
          <h2 className="ff-card-title">{title}</h2>
          {actions || (onExpand && count !== undefined) ? (
            <div className="flex items-center gap-3">
              {actions}
              {onExpand && count !== undefined ? (
                <button type="button" className="ff-more" aria-label={`${title}, büyüt`} onClick={() => root.current && onExpand(root.current.getBoundingClientRect())}>
                  {count}
                  <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={2.2} /></span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Side block of an opportunity, project or own project page: a board card, or a bare labelled section inside a project page (plain) */
export function SideSection({ title, plain, children }: { title: string; plain?: boolean; children: ReactNode }) {
  if (!plain) return <Card title={title} className="opp-side rise">{children}</Card>;
  return (
    <section className="prj-sec" data-gap="loose">
      <span className="prj-sec-label">{title}</span>
      {children}
    </section>
  );
}

/** Progress bar: solid part over a hatched remainder; optional percent knob and marker line (both 0 to 100) */
export function Meter({ value, size = "md", color = "bg-accent", knob, marker, label, className = "" }: {
  value: number;
  size?: "sm" | "md" | "lg" | "xl";
  /** background class of the solid part */
  color?: string;
  /** text of the knob that rides the end of the solid part */
  knob?: ReactNode;
  marker?: number;
  label?: string;
  className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={`ff-meter ${className}`} data-size={size} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <div className={`ff-meter-fill grow-x ${color}`} style={{ width: `${v}%` }} />
      {knob ? <div className="ff-meter-knob" style={{ left: `max(0%, calc(${v}% - var(--spacing-meter-knob-offset)))` }}>{knob}</div> : null}
      {marker !== undefined ? <div className="ff-meter-marker" style={{ left: `${marker}%` }} /> : null}
    </div>
  );
}
