import { useEffect, useRef } from "react";
import { useElapsed } from "../components/chat/StatusLine";
import { useChatLive } from "../lib/chatStore";
import { T } from "../lib/chatText";
import { isDesk } from "../lib/openRecord";
import { MASCOT_TEXT } from "../lib/mascotText";
import { CFG, DRAG_THRESHOLD, FADE_CLASS, MASCOT_IDLE_MS, MAX_DT, PERCH_X, PERCH_Y, SIZE } from "./config";
import { mascotLive, mascotPrefs, useMascotLive, useMascotPrefs, type MascotPrefs } from "./mascotStore";
import { bounds, cheer, createMotion, freeze, moodStep, pose, simulate, type Env, type MotionState, type Pointer, type Rect, type Vec2 } from "./motion";
import { customMix, CUSTOM_MIX_AMOUNT, presetColors, type BellGlow } from "./palette";
import type { MascotScene } from "./scene";

interface Props {
  /** a click on the mascot (not a drag): packet C wires it to the chat */
  onActivate: () => void;
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const idle = (fn: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn) : setTimeout(fn, 0));
/** a throw keeps the last pointer speed only if the pointer moved this recently (ms) */
const STILL_MS = 90;
const SPEED_KEEP = 0.6;
const DEBUG_KEY = "ff.mascot.debug";
const DEBUG_FRAMES = 120;
/** gap kept around the + button, its menu and the chat window (px) */
const OBSTACLE_MARGIN = 6;
const FAB_SELECTOR = 'button[aria-label="Hızlı ekle"]';
const FAB_MENU_SELECTOR = '[role="menu"][aria-label="Hızlı ekle"]:not([aria-hidden="true"])';

function rectOf(el: Element | null, perchSkip = false): Rect[] {
  if (!el) return [];
  const r = el.getBoundingClientRect();
  return r.width ? [{ x0: r.left - OBSTACLE_MARGIN, y0: r.top - OBSTACLE_MARGIN, x1: r.right + OBSTACLE_MARGIN, y1: r.bottom + OBSTACLE_MARGIN, perchSkip }] : [];
}
/** glow power while a reply runs */
const RUNNING_GLOW = 1.2;

/** Palette of the active choice: a preset from the tokens, or the custom colour with the glow mixed toward the custom-mix token */
async function colorsFor(el: Element, p: MascotPrefs): Promise<BellGlow> {
  if (p.color === "custom" && p.custom) {
    const { Color } = await import("three/webgpu");
    const glow = new Color(p.custom).lerp(new Color(customMix(el)), CUSTOM_MIX_AMOUNT);
    return { bell: p.custom, glow: `#${glow.getHexString()}` };
  }
  return presetColors(el, p.color === "custom" ? "amber" : p.color);
}

export default function Mascot({ onActivate }: Props) {
  const prefs = useMascotPrefs();
  return prefs.show ? <MascotBody onActivate={onActivate} /> : null;
}

function MascotBody({ onActivate }: Props) {
  const prefs = useMascotPrefs();
  const live = useMascotLive();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const probe = useRef<HTMLDivElement>(null);
  const scene = useRef<MascotScene | null>(null);
  const S = useRef<MotionState | null>(null);
  const latest = useRef({ prefs, onActivate });
  const size = useRef({ w: 0, h: 0 });
  const env = useRef<Env | null>(null);
  const pointer = useRef<Pointer>({ px: -1, py: -1, lastMove: -99 });
  const press = useRef({ down: false, sx: 0, sy: 0, gx: 0, gy: 0, lx: 0, ly: 0, lt: 0, vx: 0, vy: 0 });
  const lastWork = useRef(-Infinity);
  const faded = useRef(false);
  const resetsSeen = useRef(live.resets);
  const chat = useChatLive();
  const chatRef = useRef(chat);
  const seconds = useElapsed(!chat.open && chat.running ? chat.since : null);
  useEffect(() => {
    chatRef.current = chat;
  });
  // a reply that finished while the chat was minimized: it smiles once, the badge stays until the chat opens
  useEffect(() => {
    if (chat.ready && S.current) cheer(S.current);
  }, [chat.ready]);

  useEffect(() => {
    latest.current = { prefs, onActivate };
  });

  // Measure what the simulation needs: size, home spot (the old chat button), bounds right of the sidebar
  const measure = () => {
    const el = root.current, pr = probe.current;
    if (!el || !pr) return;
    const desk = isDesk();
    const w = latest.current.prefs.size * (desk ? 1 : SIZE.phoneScale);
    size.current = { w, h: w * SIZE.aspect };
    el.style.setProperty("--mascot-w", `${Math.round(w)}px`);
    el.style.setProperty("--mascot-h", `${Math.round(w * SIZE.aspect)}px`);
    const vw = innerWidth, vh = innerHeight;
    const r = pr.getBoundingClientRect();
    const sb = desk ? document.querySelector("nav.sb")?.getBoundingClientRect() : null;
    const b = bounds(size.current, vw, vh, sb ? sb.right : 0);
    // the body rests just above the + button, not on it
    const home: Vec2 = { x: Math.min(r.right - size.current.w / 2, b.x1), y: Math.min(r.bottom - size.current.h * 0.56, b.y1) };
    env.current = { reduce: reducedMotion(), size: size.current, viewport: { w: vw, h: vh }, left: sb ? sb.right : 0, obstacles: [], home, homeLock: true, perch: null };
    scene.current?.resize(Math.max(1, size.current.w), Math.max(1, size.current.h));
  };

  const applyColors = async (p: MascotPrefs) => {
    const el = root.current;
    if (!el) return;
    const c = await colorsFor(el, p);
    el.style.setProperty("--mascot-bell", c.bell);
    el.style.setProperty("--mascot-glow", c.glow);
    scene.current?.setColors(c);
  };

  // Boot: after the first idle moment, load the 3D chunk; the DOM stays empty until it is ready
  useEffect(() => {
    let cancelled = false;
    mascotLive.setEngine("loading");
    idle(async () => {
      const el = root.current, cv = canvas.current;
      if (!el || !cv || cancelled) return;
      try {
        measure();
        const colors = await colorsFor(el, latest.current.prefs);
        const { createMascotScene } = await import("./scene");
        const sc = await createMascotScene(cv, { tokens: el, variant: latest.current.prefs.variant, colors });
        if (cancelled) return sc.dispose();
        scene.current = sc;
        measure();
        await applyColors(latest.current.prefs);
        const e = env.current!;
        S.current = createMotion(e.home, latest.current.prefs.anchor);
        start();
        mascotLive.setEngine("ready");
      } catch (err) {
        console.warn("mascot: 3D unavailable", err);
        mascotLive.setEngine("failed");
      }
    });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
      mascotLive.setEngine("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scene.current?.setVariant(prefs.variant);
    if (S.current) S.current.sqV += 4;
  }, [prefs.variant]);
  useEffect(() => void applyColors(prefs), [prefs.color, prefs.custom]);
  useEffect(() => measure(), [prefs.size]);

  const hooks = {
    onPin: (a: Vec2) => mascotPrefs.setAnchor({ x: Math.round(a.x), y: Math.round(a.y) }),
  };
  const debug = useRef({ frames: 0, cpu: 0 });

  function tick(dt: number) {
    const s = S.current, e = env.current, sc = scene.current, el = root.current;
    if (!s || !e || !sc || !el) return;
    dt = Math.min(dt, MAX_DT);
    s.t += dt;
    const t0 = performance.now();
    const desk = isDesk();
    const working = performance.now() - lastWork.current < MASCOT_IDLE_MS;
    const wander = latest.current.prefs.wander && desk && !e.reduce;
    e.homeLock = working || !wander;
    // perched on the open chat window (nothing else moves it); a window as wide as the screen (phone) hides it instead
    const c = chatRef.current;
    let perch: Vec2 | null = null;
    let hide = false;
    const win = c.open ? document.getElementById("chat-window") : null;
    if (win) {
      const r = win.getBoundingClientRect();
      if (r.width >= innerWidth - 1) hide = true;
      else perch = { x: r.right - e.size.w * PERCH_X, y: r.top - e.size.h * PERCH_Y };
    }
    e.perch = perch;
    e.obstacles = [...rectOf(document.querySelector(FAB_SELECTOR)), ...rectOf(document.querySelector(FAB_MENU_SELECTOR)), ...rectOf(win, true)];
    el.classList.toggle("perched", !!perch);
    el.classList.toggle(FADE_CLASS, faded.current || hide);
    // a running reply: quicker pulse and a brighter glow
    simulate(s, e, dt, hooks, { running: c.running });
    moodStep(s);
    pose(s, dt, pointer.current);
    sc.frame(s, dt, c.running ? RUNNING_GLOW : 1);
    const bob = s.mode === "drag" || e.reduce ? 0 : Math.sin(s.t * 0.9) * CFG.bob;
    el.style.transform = `translate3d(${s.pos.x - e.size.w / 2}px, ${s.pos.y - e.size.h * 0.45 + bob}px, 0)`;
    el.style.setProperty("--pulse", (0.65 + 0.35 * s.c).toFixed(3));
    el.style.setProperty("--squeeze", s.scale.toFixed(3));
    el.dataset.mood = s.mood;
    el.dataset.mode = s.mode;
    el.dataset.push = `${s.push.l ? "l" : ""}${s.push.r ? "r" : ""}${s.push.u ? "u" : ""}${s.push.d ? "d" : ""}`;
    el.classList.toggle("pinned", s.pinned);
    el.classList.toggle("dragging", s.mode === "drag");
    if (localStorage.getItem(DEBUG_KEY) === "1") {
      const d = debug.current;
      d.frames++;
      d.cpu += performance.now() - t0;
      if (d.frames === DEBUG_FRAMES) console.info("mascot budget", { cpuMsPerFrame: +(d.cpu / d.frames).toFixed(2), ...sc.stats(), backend: sc.backend });
    }
  }

  function start() {
    const sc = scene.current;
    if (!sc) return;
    sc.loop(document.hidden ? null : tick);
  }

  // pause while the tab is hidden; react to resize and to the phone/desk switch
  useEffect(() => {
    const vis = () => scene.current?.loop(document.hidden ? null : tick);
    document.addEventListener("visibilitychange", vis);
    addEventListener("resize", measure);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rest while working: any key, wheel, touch or press outside the mascot sends it home for MASCOT_IDLE_MS
  useEffect(() => {
    const work = (e: Event) => {
      if (e.target instanceof Node && root.current?.contains(e.target)) return;
      lastWork.current = performance.now();
    };
    const look = (e: PointerEvent) => {
      pointer.current = { px: e.clientX, py: e.clientY, lastMove: S.current?.t ?? 0 };
    };
    const types = ["keydown", "wheel", "touchmove", "pointerdown"] as const;
    types.forEach((t) => document.addEventListener(t, work, { capture: true, passive: true }));
    addEventListener("pointermove", look, { passive: true });
    return () => {
      types.forEach((t) => document.removeEventListener(t, work, { capture: true }));
      removeEventListener("pointermove", look);
    };
  }, []);

  // Never cover what is in use: a modal dialog fades it out (it keeps simulating)
  useEffect(() => {
    const check = () => {
      const open = !!document.querySelector('[role="dialog"][aria-modal="true"]');
      if (open === faded.current) return;
      faded.current = open;
      // tick() applies the class together with the phone hide
    };
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-modal"] });
    check();
    return () => mo.disconnect();
  }, []);

  // "Konumu sıfırla": drop the pin and swim home
  useEffect(() => {
    if (live.resets === resetsSeen.current) return;
    resetsSeen.current = live.resets;
    const s = S.current;
    if (!s) return;
    s.pinned = false;
    s.anchor = null;
    s.travel = false;
    lastWork.current = performance.now();
  }, [live.resets]);

  // ---- pointer input on the hit proxy ----
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = S.current;
    if (e.button !== 0 || !s) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer (synthetic event): the drag still works inside the element */
    }
    freeze(s);
    Object.assign(press.current, { down: true, sx: e.clientX, sy: e.clientY, gx: e.clientX - s.pos.x, gy: e.clientY - s.pos.y, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 });
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = S.current, p = press.current;
    if (!p.down || !s) return;
    if (s.mode !== "drag" && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > DRAG_THRESHOLD) {
      s.mode = "drag";
      s.travel = false;
      // dragging takes it out of a pinned corner
      if (s.pinned) {
        s.pinned = false;
        s.anchor = null;
        mascotPrefs.setAnchor(null);
      }
    }
    if (s.mode !== "drag") return;
    const now = performance.now(), dts = Math.max(1, now - p.lt) / 1000;
    p.vx = p.vx * SPEED_KEEP + ((e.clientX - p.lx) / dts) * (1 - SPEED_KEEP);
    p.vy = p.vy * SPEED_KEEP + ((e.clientY - p.ly) / dts) * (1 - SPEED_KEEP);
    p.lx = e.clientX;
    p.ly = e.clientY;
    p.lt = now;
    s.dragTarget = { x: e.clientX - p.gx, y: e.clientY - p.gy };
  };
  const release = (cancel: boolean) => {
    const s = S.current, p = press.current;
    if (!p.down || !s) return;
    p.down = false;
    if (s.mode === "drag") {
      const still = cancel || performance.now() - p.lt > STILL_MS;
      const vx = still ? 0 : p.vx, vy = still ? 0 : p.vy, len = Math.hypot(vx, vy), k = len > CFG.maxToss ? CFG.maxToss / len : 1;
      s.vel = { x: vx * k, y: vy * k };
      s.mode = "toss";
      s.sqV += 2;
    } else if (!cancel) {
      s.sqV += 4;
      latest.current.onActivate();
    }
  };

  return (
    <>
    <div className="mascot-probe" ref={probe} aria-hidden="true" />
    <div ref={root} className="mascot" data-engine={live.engine} data-ready={chat.ready && !chat.open ? "" : undefined}>
      <div className="mascot-scale">
        <div className="mascot-halo" />
        <canvas ref={canvas} />
        <span className="mascot-pin" aria-hidden="true" />
      </div>
      {!chat.open && chat.running && chat.status && (
        <div className="mascot-pill" role="status">
          <b>{chat.status}</b>
          <i className="mono">{T.seconds(seconds)}</i>
        </div>
      )}
      <span className="cb-badge" aria-hidden="true" />
      <button
        type="button"
        className="mascot-hit"
        aria-label={MASCOT_TEXT.open}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => release(false)}
        onPointerCancel={() => release(true)}
        onPointerEnter={(e) => {
          const s = S.current;
          if (e.pointerType === "mouse" && s && s.mode === "free") {
            s.hovered = true;
            freeze(s);
          }
        }}
        onPointerLeave={() => {
          const s = S.current;
          if (s?.hovered) {
            s.hovered = false;
            s.idleUntil = s.t + 1.5;
          }
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          if (S.current) S.current.sqV += 4;
          latest.current.onActivate();
        }}
        onClick={(e) => e.preventDefault()}
      />
    </div>
    </>
  );
}

