import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { K, useBoard, useThreads } from "../api/keys";
import { useQuery } from "../api/store";
import type { Today } from "../api/types";
import { BoardIcon, type BoardIconName } from "../components/boardIcons";
import { ago } from "../lib/format";
import { OPEN_STAGES } from "../lib/labels";
import { useIsDesktop } from "../lib/media";
import { PATHS, preload, type PageKey } from "./routes";
import { setUI, useUI } from "./ui";

interface NavItem {
  key: PageKey;
  label: string;
  icon: BoardIconName;
  count?: number;
}

function NavLink({ item, active, phoneOnly }: { item: NavItem; active: boolean; phoneOnly?: boolean }) {
  return (
    <Link
      href={PATHS[item.key]}
      onPointerEnter={() => preload(item.key)}
      onFocus={() => preload(item.key)}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      className={`ff-item ${phoneOnly ? "ff-item-phone" : ""}`}
    >
      <BoardIcon name={item.icon} />
      <span className="ff-label">{item.label}</span>
      {item.count ? <span className="ff-badge">{item.count}</span> : null}
    </Link>
  );
}

const SETTINGS: NavItem = { key: "settings", label: "Ayarlar", icon: "settings" };

export function Sidebar() {
  const collapsed = useUI((s) => s.collapsed);
  const desk = useIsDesktop();
  const [path] = useLocation();
  const strip = useRef<HTMLDivElement>(null);
  const today = useQuery<Today>(K.today);
  const board = useBoard();
  const threads = useThreads();
  const openOpps = board.rows.filter((o) => OPEN_STAGES.includes(o.stage)).length;

  // Network first: who I wrote to, who answered; sales and projects come second
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Network",
      items: [
        { key: "today", label: "Dashboard", icon: "grid" },
        { key: "calendar", label: "Takvim", icon: "calendar" },
        { key: "people", label: "Kişiler", icon: "users", count: today.data?.network.awaiting.total },
        { key: "companies", label: "Firmalar", icon: "building" },
        { key: "referrals", label: "Referanslar", icon: "link" },
        { key: "drafts", label: "Taslaklar", icon: "pen", count: today.data?.drafts.total },
        { key: "comments", label: "Yorumlar", icon: "comment", count: threads.rows.length },
      ],
    },
    {
      label: "Pazarlama",
      items: [
        { key: "posts", label: "Paylaşımlar", icon: "megaphone", count: today.data?.posts_due?.total },
        { key: "ideas", label: "Gelir fikirleri", icon: "bulb" },
        { key: "templates", label: "Şablonlar", icon: "template" },
      ],
    },
    {
      label: "Satış ve projeler",
      items: [
        { key: "pipeline", label: "Satış hunisi", icon: "funnel", count: openOpps },
        { key: "projects", label: "Müşteri projeleri", icon: "folder" },
        { key: "ownProjects", label: "Kendi projelerim", icon: "cube" },
        { key: "timeline", label: "Zaman çizelgesi", icon: "clock" },
        { key: "report", label: "Rapor", icon: "chart" },
        { key: "review", label: "Haftalık inceleme", icon: "review" },
      ],
    },
  ];
  const isActive = (k: PageKey) => (k === "today" ? path === "/" : path === PATHS[k] || path.startsWith(`${PATHS[k]}/`));

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
            {g.items.map((it) => <NavLink key={it.key} item={it} active={isActive(it.key)} />)}
          </div>
        ))}
        <NavLink item={SETTINGS} active={isActive("settings")} phoneOnly />
      </div>

      <div className="ff-sidefoot">
        <NavLink item={SETTINGS} active={isActive("settings")} />
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
