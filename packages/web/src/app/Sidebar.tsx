import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { Today } from "../api/types";
import { BoardIcon, type BoardIconName } from "../components/boardIcons";
import { ago } from "../lib/format";
import { useIsDesktop } from "../lib/media";
import { preloadRoute, useRegistry } from "./modules/registry";
import { PATHS } from "./routes";
import { setUI, useUI } from "./ui";

interface NavItem {
  label: string;
  icon: BoardIconName;
  path: string;
  /** a module's count hook (see NavEntry.useBadge) */
  useBadge?: () => number | null | undefined;
}

function NavLink({ item, active, phoneOnly }: { item: NavItem; active: boolean; phoneOnly?: boolean }) {
  const count = item.useBadge?.();
  return (
    <Link
      href={item.path}
      onPointerEnter={() => preloadRoute({ path: item.path })}
      onFocus={() => preloadRoute({ path: item.path })}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      className={`ff-item ${phoneOnly ? "ff-item-phone" : ""}`}
    >
      <BoardIcon name={item.icon} />
      <span className="ff-label">{item.label}</span>
      {count ? <span className="ff-badge">{count}</span> : null}
    </Link>
  );
}

const SETTINGS: NavItem = { label: "Ayarlar", icon: "settings", path: PATHS.settings };

export function Sidebar() {
  const collapsed = useUI((s) => s.collapsed);
  const desk = useIsDesktop();
  const [path] = useLocation();
  const strip = useRef<HTMLDivElement>(null);
  const today = useQuery<Today>(K.today);
  // the groups and items come from the installed, visible modules (a group without items has no label)
  const groups = useRegistry().nav;
  const isActive = (to: string) => (to === PATHS.today ? path === "/" : path === to || path.startsWith(`${to}/`));

  // On the phone strip the current page scrolls into view
  useEffect(() => {
    if (desk) return;
    strip.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [desk, path]);

  return (
    <nav aria-label="Ana menü" className={`sb ff-side ${collapsed ? "is-mini" : ""}`}>
      <div className="ff-brand">
        <div className="ff-logo">ff</div>
        <span className="ff-brandname">Full Follow</span>
        <button
          type="button"
          className="ff-toggle"
          aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          aria-expanded={!collapsed}
          title={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
          onClick={() => setUI({ collapsed: !collapsed })}
        >
          <BoardIcon name="sidebar" className="size-icon-md" />
        </button>
      </div>

      <div ref={strip} className="ff-nav">
        {groups.map((g) => (
          <div key={g.label} className="ff-group">
            <span className="ff-glabel">{g.label}</span>
            {g.items.map((it) => <NavLink key={it.path} item={it} active={isActive(it.path)} />)}
          </div>
        ))}
        <NavLink item={SETTINGS} active={isActive(PATHS.settings)} phoneOnly />
      </div>

      <div className="ff-sidefoot">
        <NavLink item={SETTINGS} active={isActive(PATHS.settings)} />
        <div className="ff-user">
          <div className="ff-user-avatar">ÖD</div>
          <div className="ff-userinfo">
            <span className="ff-username">Özgür</span>
            <span className="ff-userstatus" title="Claude’un MCP ile yaptığı son işlem">
              <i />
              <span>{today.data?.claude_last_at ? `Claude: ${ago(today.data.claude_last_at)}` : "Claude henüz bağlanmadı"}</span>
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
