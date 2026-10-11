import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { K, useBoard, useThreads } from "../api/keys";
import { useQuery } from "../api/store";
import type { Today } from "../api/types";
import { Icon, type IconName } from "../components/icons";
import { ago } from "../lib/format";
import { OPEN_STAGES } from "../lib/labels";
import { PATHS, preload, type PageKey } from "./routes";
import { setUI, useUI } from "./ui";

interface NavItem {
  key: PageKey;
  label: string;
  icon: IconName;
  count?: number;
  tone?: "opportunity" | "claude";
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={PATHS[item.key]}
      onPointerEnter={() => preload(item.key)}
      onFocus={() => preload(item.key)}
      onClick={() => setUI({ drawer: false })}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={`group flex h-nav-item-height items-center gap-5 rounded-lg px-4 text-base transition-colors dur-hover ${
        active ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary"
      }`}
    >
      <span className={`flex-none ${active ? "text-primary-text" : ""}`}>
        <Icon name={item.icon} />
      </span>
      <span className="lbl">{item.label}</span>
      {item.count ? (
        <span
          className={`lbl ml-auto rounded-pill px-2 text-xs font-medium ${
            item.tone === "opportunity" ? "bg-chip-opportunity-bg text-chip-opportunity-fg" : "bg-author-claude-bg text-author-claude-fg"
          }`}
        >
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.collapsed);
  const drawer = useUI((s) => s.drawer);
  const [path] = useLocation();
  const today = useQuery<Today>(K.today);
  const board = useBoard();
  const threads = useThreads();
  const openOpps = board.rows.filter((o) => OPEN_STAGES.includes(o.stage)).length;

  // Esc ile çekmeceyi kapat
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setUI({ drawer: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Network önce: kime yazdım, kim döndü; satış ve projeler ikinci planda
  const main: NavItem[] = [
    { key: "today", label: "Dashboard", icon: "grid" },
    { key: "calendar", label: "Takvim", icon: "calendar" },
    { key: "people", label: "Kişiler", icon: "people", count: today.data?.network.awaiting.total, tone: "opportunity" },
    { key: "companies", label: "Firmalar", icon: "building" },
    { key: "referrals", label: "Referanslar", icon: "referral" },
    { key: "drafts", label: "Taslaklar", icon: "pen", count: today.data?.drafts.total },
    { key: "comments", label: "Yorumlar", icon: "comment", count: threads.rows.length },
  ];
  const marketing: NavItem[] = [
    { key: "posts", label: "Paylaşımlar", icon: "megaphone", count: today.data?.posts_due.total, tone: "opportunity" },
    { key: "ideas", label: "Para fikirleri", icon: "bulb" },
    { key: "templates", label: "Şablonlar", icon: "template" },
  ];
  const second: NavItem[] = [
    { key: "pipeline", label: "Satış hunisi", icon: "funnel", count: openOpps, tone: "opportunity" },
    { key: "projects", label: "Müşteri projeleri", icon: "folder" },
    { key: "ownProjects", label: "Kendi projelerim", icon: "cube" },
    { key: "timeline", label: "Zaman çizelgesi", icon: "clock" },
    { key: "report", label: "Rapor", icon: "chart" },
  ];
  const isActive = (k: PageKey) => (k === "today" ? path === "/" : path === PATHS[k] || path.startsWith(`${PATHS[k]}/`));

  return (
    <>
      <button
        type="button"
        aria-label="Menüyü kapat"
        tabIndex={drawer ? 0 : -1}
        className={`fixed inset-0 z-scrim border-0 bg-bg-scrim p-0 transition-opacity dur-sidebar desk:hidden ${drawer ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setUI({ drawer: false })}
      />
      <nav
        aria-label="Ana menü"
        data-collapsed={collapsed || undefined}
        className={`sb fixed inset-y-0 left-0 z-sidebar flex w-drawer-width flex-none flex-col gap-2 overflow-y-auto overflow-x-hidden border-r border-border-sidebar bg-bg-sidebar px-4 py-6 shadow-drawer transition-transform dur-drawer ease-out
          desk:sticky desk:top-0 desk:h-dvh desk:translate-x-0 desk:shadow-none desk:transition-[width] desk:dur-sidebar
          ${drawer ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "desk:w-sidebar-collapsed" : "desk:w-sidebar-width"}`}
      >
        <div className="mb-4 flex h-control-height-lg items-center gap-4 pl-2 pr-2">
          <div className="flex size-logo flex-none items-center justify-center rounded-lg bg-primary text-base-sm font-semibold tracking-title text-primary-on">FF</div>
          <span className="lbl text-md font-semibold tracking-subtitle">Full Follow</span>
        </div>

        <span className="lbl px-4 pb-2 text-xs font-medium text-text-muted">Network</span>
        {main.map((it) => <NavLink key={it.key} item={it} active={isActive(it.key)} />)}
        <div className="mx-1 my-5 h-px bg-border-sidebar" />
        <span className="lbl px-4 pb-2 text-xs font-medium text-text-muted">Pazarlama</span>
        {marketing.map((it) => <NavLink key={it.key} item={it} active={isActive(it.key)} />)}
        <div className="mx-1 my-5 h-px bg-border-sidebar" />
        <span className="lbl px-4 pb-2 text-xs font-medium text-text-muted">Satış ve projeler</span>
        {second.map((it) => <NavLink key={it.key} item={it} active={isActive(it.key)} />)}

        <div className="flex-grow" />
        <NavLink item={{ key: "settings", label: "Ayarlar", icon: "sliders" }} active={isActive("settings")} />

        <div className="mt-2 flex items-center gap-4 border-t border-border-sidebar px-1 pb-0.5 pt-3">
          <div className="flex size-avatar-sm flex-none items-center justify-center rounded-pill bg-author-ozgur-bg text-base-sm font-semibold text-author-ozgur-fg">Ö</div>
          <div className="lbl flex min-w-0 flex-grow flex-col">
            <span className="text-base-sm font-medium">Özgür</span>
            <span className="truncate text-sm text-text-secondary" title="Claude’un MCP ile yaptığı son işlem">{today.data?.claude_last_at ? `Claude: ${ago(today.data.claude_last_at)}` : "Claude henüz bağlanmadı"}</span>
          </div>
          <button type="button" className="ibtn lbl hidden desk:inline-flex" aria-label="Menüyü daralt" onClick={() => setUI({ collapsed: true })}>
            <Icon name="panel" />
          </button>
        </div>
        {collapsed ? (
          <button type="button" className="ibtn mx-auto mt-2 hidden desk:inline-flex" aria-label="Menüyü genişlet" onClick={() => setUI({ collapsed: false })}>
            <Icon name="panelOpen" />
          </button>
        ) : null}
      </nav>
    </>
  );
}
