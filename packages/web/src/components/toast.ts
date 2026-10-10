// Bildirim deposu (görünüm Toasts.tsx'te, ayrı parça olarak yüklenir)
export interface ToastAction {
  label: string;
  /** düğmeye basınca: ya bir iş (geri al) ya da bir sayfa (kayda git) */
  run?: () => void;
  href?: string;
}
export interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "error";
  action?: ToastAction;
}
let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

/** Eylemli bildirim (Geri al, Kayda git) okumaya ve basmaya vakit kalsın diye daha uzun durur */
const LIFE = { ok: 3500, error: 6000, action: 8000 };

export function toast(text: string, kind: ToastItem["kind"] = "ok", action?: ToastAction) {
  const id = ++seq;
  items = [...items.slice(-2), { id, text, kind, action }];
  emit();
  setTimeout(() => dismiss(id), action ? LIFE.action : LIFE[kind]);
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const subscribeToasts = (fn: () => void) => (subs.add(fn), () => void subs.delete(fn));
export const getToasts = () => items;
