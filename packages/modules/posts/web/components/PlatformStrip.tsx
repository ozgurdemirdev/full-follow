import type { CSSProperties } from "react";
import { lira } from "@kit/lib/format";
import { PLATFORM_BAR, type PerPost, type PlatformStat } from "../posts";
import { Meter } from "@kit/components/ui";

function Col({ name, dot, value, sub, width }: { name: string; dot: string; value: string; sub: string; width: number }) {
  return (
    <div className="posts-kpi-col">
      <span className="posts-kpi-name"><span className={`size-dot rounded-pill ${dot}`} />{name}</span>
      <span className="posts-kpi-value">{value}</span>
      <span className="posts-kpi-sub">{sub}</span>
      <Meter value={width} size="sm" color={dot} label={name} />
    </div>
  );
}

/** Won value per platform with a bar against the best one, and the people per post column */
export function PlatformStrip({ stats, per, style }: { stats: PlatformStat[]; per: PerPost; style?: CSSProperties }) {
  return (
    <section className="posts-kpi rise" style={style} aria-label="Platformlar">
      {stats.map((s) => (
        <Col key={s.key} name={s.name} dot={PLATFORM_BAR[s.key]} value={lira(s.won)} sub={`${s.count} paylaşım · ${s.people} kişi geldi`} width={s.width} />
      ))}
      <Col name="Paylaşım başına" dot="bg-accent" value={`${per.average} kişi`} sub={per.best ? `en verimli: ${per.best}` : "henüz kişi gelmedi"} width={per.width} />
    </section>
  );
}
