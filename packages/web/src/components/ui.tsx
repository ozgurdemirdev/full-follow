import type { CSSProperties, ReactNode } from "react";
import type { ApiError } from "../api/client";
import { useTags } from "../api/keys";
import { initials } from "../lib/format";
import { ACTOR, CONTACT_STATUS, STATUS_TONE, TAG_CLS, TONE_CLS, WHO_CLS, type Actor, type Tone } from "../lib/labels";

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

const AV = { sm: "size-avatar-sm text-base-sm", md: "size-avatar-md text-base-sm", list: "size-avatar-list text-base-sm", lg: "size-avatar-lg text-md", xl: "size-avatar-xl text-lg" };
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof AV }) {
  return <span className={`avatar ${AV[size]}`} aria-hidden="true">{initials(name)}</span>;
}

/** Kademeli giriş animasyonu için sıra numarası */
export const order = (i: number): CSSProperties => ({ ["--i" as string]: Math.min(i, 12) });

/** Filtre çipleri (tek seçim) */
export function Filters<T extends string | number>({
  items, value, onChange, label,
}: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={String(it.value)} type="button" className="fchip" aria-pressed={it.value === value} onClick={() => onChange(it.value)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Kayan göstergeli segment kontrol; genişlik verilmezse telefonda dar, masaüstünde geniş sekme (telefonda 3 sekme taşmasın) */
export function Segmented({
  items, value, onChange, label, width,
}: { items: string[]; value: number; onChange: (i: number) => void; label: string; width?: string }) {
  return (
    <div className="seg rise" role="tablist" aria-label={label} style={width ? { ["--seg-w" as string]: width } : undefined}>
      <span className="seg-ind" style={{ transform: `translateX(${value * 100}%)` }} />
      {items.map((l, i) => (
        <button key={l} type="button" role="tab" className="seg-btn" aria-selected={i === value} onClick={() => onChange(i)}>
          {l}
        </button>
      ))}
    </div>
  );
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
