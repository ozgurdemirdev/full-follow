import { Link } from "wouter";
import { useThreads } from "../../api/keys";
import { PATHS } from "../../app/routes";
import { SHOWN } from "../../lib/dashboard";
import { ago } from "../../lib/format";
import { ACTOR, TARGET } from "../../lib/labels";
import { Card } from "../ui";
import { useExpand } from "../ExpandOverlay";
import { DashOverlay, type ExRow } from "./DashOverlay";

const WHO_CHIP = { ozgur: "bg-accent-soft-bg text-accent", claude: "bg-claude-bg text-claude-soft" };
const WAITING = { claude: "Senin cevabın bekleniyor", ozgur: "Claude’un cevabı bekleniyor" };

/** "Yorumlar": the open threads, who wrote last and whose answer is waited for */
export function CommentsCard() {
  const ex = useExpand();
  const threads = useThreads();
  const open = threads.rows.filter((t) => !t.resolved_at);
  const mine = open.filter((t) => t.last_by === "claude").length;
  const rows: ExRow[] = open.map((t) => ({
    key: t.id, lead: t.last_by === "claude" ? "CL" : "ÖD", title: t.target_label, sub: t.last_body, right: ago(t.last_at),
    tag: t.last_by === "claude" ? "Senin cevabın" : "Claude’un cevabı", dot: t.last_by === "claude" ? "bg-warning" : "bg-claude", href: PATHS.comments,
  }));

  return (
    <>
      <Card title="Yorumlar" count={`${open.length} konu`} onExpand={(r) => ex.show("comments", r)} className="dash-gap-5 dash-head-pad rise">
        {open.length === 0 ? <p className="m-0 text-base-sm text-text-muted">Açık yorum yok.</p> : null}
        {open.slice(0, SHOWN.comments).map((t) => (
          <Link key={t.id} href={PATHS.comments} className="dash-row flex flex-col gap-3 border-t border-border-subtle py-6 text-text-primary hover:text-text-primary">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`dash-chip is-xs ${WHO_CHIP[t.last_by]}`}>{ACTOR[t.last_by]}</span>
              <span className="text-sm text-text-secondary">{TARGET[t.target_type] ?? t.target_type}: {t.target_label} · {ago(t.last_at)}</span>
            </div>
            <p className="m-0 line-clamp-3 text-base leading-relaxed text-text-body">{t.last_body}</p>
            <span className={`text-sm ${t.last_by === "claude" ? "text-warning" : "text-text-secondary"}`}>{WAITING[t.last_by]}</span>
          </Link>
        ))}
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Yorumlar", sub: `${open.length} açık konu · ${mine} tanesi senin cevabını bekliyor`, page: "Yorumlar", href: PATHS.comments, foot: `${open.length - mine} konuda Claude’un cevabı bekleniyor`, rows }} />
    </>
  );
}
