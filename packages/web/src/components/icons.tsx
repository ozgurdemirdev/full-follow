// Tasarımdaki çizgi ikonlar (ikon kütüphanesi yok: sadece kullanılan yollar)
const P = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  funnel: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  people: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6" /></>,
  referral: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.5 8l3.3 7.8M16.5 8l-3.3 7.8M8.5 6h7" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chart: <path d="M5 20V11M11 20V5M17 20v-6M3 20h18" />,
  pen: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  comment: <path d="M5 5h14v10H9l-4 4z" />,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16" /></>,
  panelOpen: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M9 4v16M13 10l2 2-2 2" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12l5 5 9-10" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />,
  megaphone: <><path d="M4 10v4h3l7 4V6L7 10z" /><path d="M17.5 9a4 4 0 0 1 0 6M7 14l1.5 5h2.5l-1-4.4" /></>,
  bulb: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  template: <><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  refresh: <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />,
  building: <path d="M4 20V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15M15 9h4a1 1 0 0 1 1 1v10M3 20h18M8 8h3M8 12h3M8 16h3" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />,
} as const;

export type IconName = keyof typeof P;

export function Icon({ name, className = "size-icon-lg", stroke = 1.75 }: { name: IconName; className?: string; stroke?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
