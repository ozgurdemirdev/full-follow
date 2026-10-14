import { useSyncExternalStore } from "react";
import { DEFAULT_VARIANT, SIZE, VARIANTS } from "./config";
import type { ColorChoice } from "./palette";
import { PRESET_IDS } from "./palette";

// Prefs persist like chatPrefs (every access in try/catch); the live state does not.
const KEY = "ff.mascot.";
const ANCHOR_KEY = `${KEY}anchor`;

export interface Anchor { x: number; y: number }
export interface MascotPrefs {
  show: boolean;
  wander: boolean;
  variant: string;
  color: ColorChoice;
  custom: string | null;
  size: number;
  anchor: Anchor | null;
}
export type Engine = "idle" | "loading" | "ready" | "failed";
export interface MascotLive {
  engine: Engine;
  /** bumped by resetPosition so the running mascot swims home */
  resets: number;
}

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(KEY + k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(KEY + k);
    else localStorage.setItem(KEY + k, v);
  } catch {
    /* private window */
  }
};
const flag = (k: string, fallback: boolean) => {
  const v = read(k);
  return v === null ? fallback : v === "1";
};

function loadAnchor(): Anchor | null {
  try {
    const a = JSON.parse(localStorage.getItem(ANCHOR_KEY) ?? "null");
    return a && Number.isFinite(a.x) && Number.isFinite(a.y) ? { x: a.x, y: a.y } : null;
  } catch {
    return null;
  }
}

function load(): MascotPrefs {
  const variant = read("variant") ?? DEFAULT_VARIANT;
  const color = read("color") as ColorChoice | null;
  const size = Number(read("size"));
  return {
    show: flag("show", true),
    wander: flag("wander", false),
    variant: variant in VARIANTS ? variant : DEFAULT_VARIANT,
    color: color === "custom" || (PRESET_IDS as readonly string[]).includes(color ?? "") ? (color as ColorChoice) : "amber",
    custom: read("custom"),
    size: Number.isFinite(size) && size > 0 ? Math.min(SIZE.max, Math.max(SIZE.min, size)) : SIZE.initial,
    anchor: loadAnchor(),
  };
}

let prefs = load();
let live: MascotLive = { engine: "idle", resets: 0 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());
const subscribe = (fn: () => void) => (subs.add(fn), () => void subs.delete(fn));

function patch(p: Partial<MascotPrefs>) {
  prefs = { ...prefs, ...p };
  emit();
}

export const mascotPrefs = {
  get: () => prefs,
  subscribe,
  setShow: (v: boolean) => (write("show", v ? "1" : "0"), patch({ show: v })),
  setWander: (v: boolean) => (write("wander", v ? "1" : "0"), patch({ wander: v })),
  setVariant: (v: string) => (write("variant", v), patch({ variant: v })),
  setColor: (c: ColorChoice) => (write("color", c), patch({ color: c })),
  /** a custom colour also becomes the active colour */
  setCustom: (hex: string) => (write("custom", hex), write("color", "custom"), patch({ custom: hex, color: "custom" })),
  setSize: (px: number) => {
    const size = Math.min(SIZE.max, Math.max(SIZE.min, Math.round(px)));
    write("size", String(size));
    patch({ size });
  },
  setAnchor: (a: Anchor | null) => {
    try {
      if (a) localStorage.setItem(ANCHOR_KEY, JSON.stringify(a));
      else localStorage.removeItem(ANCHOR_KEY);
    } catch {
      /* private window */
    }
    patch({ anchor: a });
  },
  /** clears the pin and sends the running mascot home */
  resetPosition: () => {
    mascotPrefs.setAnchor(null);
    live = { ...live, resets: live.resets + 1 };
    emit();
  },
};

export const mascotLive = {
  get: () => live,
  subscribe,
  setEngine: (engine: Engine) => {
    live = { ...live, engine };
    emit();
  },
};

export const useMascotPrefs = () => useSyncExternalStore(mascotPrefs.subscribe, mascotPrefs.get);
export const useMascotLive = () => useSyncExternalStore(mascotLive.subscribe, mascotLive.get);
