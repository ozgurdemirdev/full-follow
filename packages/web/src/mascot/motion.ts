// The Three.js free part of the mascot: state, swim and wander physics, drag and throw, moods, springs.
// Port of the page script of docs/design/maskot/prototype.html. Vectors are plain {x, y, z} objects; scene.ts converts.
import { CFG, SQUEEZE_HOLD, SQUEEZE_IN, SQUEEZE_MIN, SQUEEZE_OUT } from "./config";

export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }
export type Mode = "free" | "drag" | "toss" | "fall";
export type Mood = "normal" | "flying" | "ouch" | "dizzy" | "shake" | "happy";

export interface Bounds { x0: number; x1: number; y0: number; y1: number }
/** A box the mascot cannot swim into (the + button and its menu, the open chat window), in viewport pixels */
export interface Rect extends Bounds {
  /** skipped while the mascot sits at its perch spot (it rests on the chat window edge on purpose) */
  perchSkip?: boolean;
}

/** The body around the position: half width, and how far it reaches above and below (the same numbers the bounds use) */
const BODY = { halfW: 0.32, up: 0.3, down: 0.56 } as const;

/** What the outside world says this frame; the simulation never reads the DOM */
export interface Env {
  reduce: boolean;
  size: { w: number; h: number };
  viewport: { w: number; h: number };
  /** right edge of the sidebar on desk width: the left wall */
  left: number;
  obstacles: Rect[];
  /** where it waits: the old chat button spot */
  home: Vec2;
  /** swim home and stay there (working, wander off, phone) */
  homeLock: boolean;
  /** perched on something (the chat window): this point wins over everything, no dizzy fall */
  perch: Vec2 | null;
}

export interface MotionState {
  mode: Mode;
  travel: boolean;
  target: Vec2 | null;
  idleUntil: number;
  pos: Vec2;
  vel: Vec2;
  pinned: boolean;
  anchor: Vec2 | null;
  tempAnchor: Vec2 | null;
  hovered: boolean;
  dragTarget: Vec2;
  phase: number;
  /** contraction of the bell, 0 to 1 */
  c: number;
  lean: number;
  yaw: number;
  pitch: number;
  sq: number;
  sqV: number;
  trail: Vec3;
  trailV: Vec3;
  nextBlink: number;
  blinkT: number;
  t: number;
  shear: number;
  shearV: number;
  limp: number;
  mood: Mood;
  moodUntil: number;
  shakeT: number;
  fallX: number;
  /** 1 normally, shrinks while the body is squeezed between obstacles and walls, then grows back */
  scale: number;
  /** which sides pushed on it this frame (walls and obstacles): left, right, up, down */
  push: { l: boolean; r: boolean; u: boolean; d: boolean };
  /** how long it has been pushed from two opposite sides (s) */
  pinchT: number;
}

export interface Pointer { px: number; py: number; lastMove: number }
export interface Hooks {
  /** a position became the pin (landed after a dizzy fall, or dragged while pinned): persist it */
  onPin: (anchor: Vec2) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const damp = (k: number, dt: number) => Math.exp(-k * dt);
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function createMotion(start: Vec2, anchor: Vec2 | null): MotionState {
  return {
    mode: "free", travel: false, target: null, idleUntil: 1.5,
    pos: { ...(anchor ?? start) }, vel: { x: 0, y: 0 },
    pinned: !!anchor, anchor: anchor ? { ...anchor } : null, tempAnchor: null, hovered: false, dragTarget: { x: 0, y: 0 },
    phase: 0, c: 0, lean: 0, yaw: 0, pitch: 0, sq: 0, sqV: 0,
    trail: { x: 0, y: 0, z: 0 }, trailV: { x: 0, y: 0, z: 0 }, nextBlink: 2, blinkT: -1, t: 0,
    shear: 0, shearV: 0, limp: 0, mood: "normal", moodUntil: Infinity, shakeT: 0, fallX: 0, scale: 1, push: { l: false, r: false, u: false, d: false }, pinchT: 0,
  };
}

export function bounds(size: { w: number; h: number }, vw: number, vh: number, left = 0): Bounds {
  return { x0: Math.max(left, 0) + size.w * 0.32, x1: vw - size.w * 0.32, y0: size.h * 0.3, y1: vh - size.h * 0.56 };
}

/** Where a locked mascot sits: the perch, else home unless it is pinned in a corner */
const lockTarget = (S: MotionState, env: Env): Vec2 | null => env.perch ?? (!S.pinned && env.homeLock ? env.home : null);

function holdAnchor(S: MotionState, env: Env): Vec2 {
  return lockTarget(S, env) ?? (S.pinned ? S.anchor : S.tempAnchor) ?? S.pos;
}

function holding(S: MotionState, env: Env): boolean {
  if (S.mode !== "free") return false;
  const lock = lockTarget(S, env);
  return S.pinned || S.hovered || (!!lock && dist(lock, S.pos) <= CFG.arrive);
}

/** Stop on the spot: kill the swim velocity and hold where it is now */
export function freeze(S: MotionState) {
  S.vel = { x: 0, y: 0 };
  S.travel = false;
  S.tempAnchor = { ...S.pos };
  if (S.mode === "toss") S.mode = "free";
  // Caught mid fall: it stops, and the daze wears off soon.
  if (S.mode === "fall") {
    S.mode = "free";
    if (S.mood === "dizzy") S.moodUntil = S.t + CFG.dizzyHold / 2;
  }
}

function settle(S: MotionState, hooks: Hooks) {
  S.mode = "free";
  if (S.pinned) {
    S.anchor = { ...S.pos };
    hooks.onPin(S.anchor);
  }
  S.tempAnchor = { ...S.pos };
  S.travel = false;
  S.idleUntil = S.t + 1.5;
}

function contraction(ph: number) {
  if (ph < 0.3) {
    const u = ph / 0.3;
    return 1 - (1 - u) * (1 - u);
  }
  const u = (ph - 0.3) / 0.7;
  return 1 - u * u * (3 - 2 * u);
}

function randTarget(b: Bounds): Vec2 {
  return { x: rand(b.x0 + 40, b.x1 - 40), y: rand(b.y0 + 60, b.y1 - 40) };
}

export interface Status {
  /** a chat reply is running: faster pulse (packet C) */
  running: boolean;
}

export function simulate(S: MotionState, env: Env, dt: number, hooks: Hooks, status: Status = { running: false }) {
  S.push = { l: false, r: false, u: false, d: false };
  const sz = { w: env.size.w * S.scale, h: env.size.h * S.scale };
  const b = bounds(sz, env.viewport.w, env.viewport.h, env.left);
  const lock = lockTarget(S, env);
  const travelling = S.mode === "free" && S.travel && !holding(S, env);
  const pulse = travelling ? CFG.pulseTravel : status.running ? CFG.pulseTravel * 0.6 : CFG.pulseIdle;
  S.phase += dt / pulse;
  let wrapped = false;
  if (S.phase >= 1) {
    S.phase -= 1;
    wrapped = true;
  }
  S.c = contraction(S.phase) * (env.reduce ? CFG.reducedPulse : 1);

  if (S.mode === "free") {
    if (lock && !S.hovered && !S.travel && dist(lock, S.pos) > CFG.arrive) {
      S.target = lock;
      S.travel = true;
    } else if (!lock && !S.pinned && !S.travel && !S.hovered && S.t > S.idleUntil && !env.reduce) {
      S.target = randTarget(b);
      S.travel = true;
    }
    if (holding(S, env)) {
      const a = holdAnchor(S, env);
      S.vel.x += ((a.x - S.pos.x) * CFG.holdK - S.vel.x * CFG.holdD) * dt;
      S.vel.y += ((a.y - S.pos.y) * CFG.holdK - S.vel.y * CFG.holdD) * dt;
    } else {
      if (S.travel && S.target) {
        if (lock) S.target = lock;
        const dx = S.target.x - S.pos.x, dy = S.target.y - S.pos.y, d = Math.hypot(dx, dy);
        if (d < CFG.arrive) {
          S.travel = false;
          S.idleUntil = S.t + rand(CFG.idleMin, CFG.idleMax);
        } else if (wrapped) {
          const k = (CFG.impulse * Math.min(1, d / 160) + 20) / d;
          S.vel.x += dx * k;
          S.vel.y += dy * k;
        }
      }
      const f = damp(CFG.waterDrag, dt);
      S.vel.x *= f;
      S.vel.y *= f;
    }
  } else if (S.mode === "drag") {
    const k = CFG.dragK, d = 2 * Math.sqrt(k) * 0.9;
    S.vel.x += ((S.dragTarget.x - S.pos.x) * k - S.vel.x * d) * dt;
    S.vel.y += ((S.dragTarget.y - S.pos.y) * k - S.vel.y * d) * dt;
  } else if (S.mode === "toss") {
    const f = damp(CFG.tossDrag, dt);
    S.vel.x *= f;
    S.vel.y *= f;
    if (Math.hypot(S.vel.x, S.vel.y) < CFG.settleSpeed) settle(S, hooks);
  } else {
    S.vel.y += CFG.gravity * dt;
    S.vel.x += (S.fallX - S.pos.x) * CFG.fallPull * dt;
    S.vel.x *= damp(CFG.fallDragX, dt);
  }
  S.pos.x += S.vel.x * dt;
  S.pos.y += S.vel.y * dt;

  for (const [ax, lo, hi] of [["x", b.x0, b.x1], ["y", b.y0, b.y1]] as const) {
    if (S.pos[ax] >= lo && S.pos[ax] <= hi) continue;
    const floor = ax === "y" && S.pos.y > hi;
    // a wall pushes the body back in: from the left/top when it was past lo, from the right/bottom when past hi
    if (S.pos[ax] < lo) S.push[ax === "x" ? "l" : "u"] = true;
    else S.push[ax === "x" ? "r" : "d"] = true;
    S.pos[ax] = clamp(S.pos[ax], lo, hi);
    if (S.mode === "drag") {
      S.vel[ax] = 0;
      continue;
    }
    const impact = Math.abs(S.vel[ax]);
    S.sqV += Math.min(impact * 0.004, 6);
    S.shearV += (ax === "x" ? Math.sign(S.vel.x) : 0.5) * impact * CFG.impactShear;
    if (S.mode === "fall" && floor && impact < CFG.landSpeed) {
      land(S, { x: S.fallX, y: b.y1 }, hooks);
      continue;
    }
    S.vel[ax] *= -(S.mode === "fall" ? CFG.fallBounce : CFG.restitution);
    if (S.mode !== "fall") onImpact(S, env, impact);
  }
  collide(S, env, hooks, sz);
  squeeze(S, env, dt);
}

/** Does a body of this scale, kept inside the walls, still overlap an obstacle? */
function blocked(S: MotionState, env: Env, scale: number): boolean {
  const w = env.size.w * scale, h = env.size.h * scale;
  const b = bounds({ w, h }, env.viewport.w, env.viewport.h, env.left);
  const x = clamp(S.pos.x, b.x0, b.x1), y = clamp(S.pos.y, b.y0, b.y1);
  return env.obstacles.some((o) => {
    if (o.perchSkip && env.perch && dist(S.pos, env.perch) < CFG.arrive * 2) return false;
    return !(x + w * BODY.halfW <= o.x0 || x - w * BODY.halfW >= o.x1 || y + h * BODY.down <= o.y0 || y - h * BODY.up >= o.y1);
  });
}

/** Squeezed: pushed from two opposite sides at once (a wall and an obstacle, or two obstacles) for a moment. It shrinks quickly and grows back slowly once the full body fits again. */
function squeeze(S: MotionState, env: Env, dt: number) {
  const pinched = (S.push.l && S.push.r) || (S.push.u && S.push.d);
  S.pinchT = pinched ? S.pinchT + dt : Math.max(0, S.pinchT - dt * 2);
  // while the full body would still be pinched it stays small, otherwise it grows
  const target = pinched && S.pinchT > SQUEEZE_HOLD ? SQUEEZE_MIN : S.scale < 1 && blocked(S, env, 1) ? S.scale : 1;
  const rate = target < S.scale ? SQUEEZE_IN : SQUEEZE_OUT;
  S.scale += (target - S.scale) * (1 - Math.exp(-rate * dt));
}

/**
 * Obstacles push the body out along the shallowest side. A body moving into one bounces like off a wall (and can get dizzy);
 * a box that grows into it (the menu opening) just shoves it. A falling body that comes down on one lands on it.
 */
function collide(S: MotionState, env: Env, hooks: Hooks, size: { w: number; h: number }) {
  const { w, h } = size;
  for (const o of env.obstacles) {
    if (o.perchSkip && env.perch && dist(S.pos, env.perch) < CFG.arrive * 2) continue;
    const l = S.pos.x - w * BODY.halfW, r = S.pos.x + w * BODY.halfW, t = S.pos.y - h * BODY.up, b = S.pos.y + h * BODY.down;
    if (r <= o.x0 || l >= o.x1 || b <= o.y0 || t >= o.y1) continue;
    const sides = [
      { ax: "x" as const, sign: -1, depth: r - o.x0 },
      { ax: "x" as const, sign: 1, depth: o.x1 - l },
      { ax: "y" as const, sign: -1, depth: b - o.y0 },
      { ax: "y" as const, sign: 1, depth: o.y1 - t },
    ];
    const hit = sides.reduce((a, c) => (c.depth < a.depth ? c : a));
    S.pos[hit.ax] += hit.sign * hit.depth;
    S.push[hit.ax === "x" ? (hit.sign < 0 ? "r" : "l") : hit.sign < 0 ? "d" : "u"] = true;
    if (S.mode === "drag") {
      S.vel[hit.ax] = 0;
      continue;
    }
    // only a body moving into the obstacle bounces; one that is pushed away keeps its speed
    if (Math.sign(S.vel[hit.ax]) !== -hit.sign || S.vel[hit.ax] === 0) continue;
    const impact = Math.abs(S.vel[hit.ax]);
    S.sqV += Math.min(impact * 0.004, 6);
    S.shearV += (hit.ax === "x" ? Math.sign(S.vel.x) : 0.5) * impact * CFG.impactShear;
    if (S.mode === "fall" && hit.ax === "y" && hit.sign === -1 && impact < CFG.landSpeed) {
      land(S, { x: S.pos.x, y: S.pos.y }, hooks);
      continue;
    }
    S.vel[hit.ax] *= -(S.mode === "fall" ? CFG.fallBounce : CFG.restitution);
    if (S.mode !== "fall") onImpact(S, env, impact);
  }
}

function setMood(S: MotionState, m: Mood, until = Infinity) {
  S.mood = m;
  S.moodUntil = until;
}

/** Hard hits stun it and it drops to the nearest bottom corner; softer ones only say ouch. Reduced motion and perching only squash. */
function onImpact(S: MotionState, env: Env, impact: number) {
  if (env.reduce) return;
  if (impact > CFG.dizzyImpact && !env.perch) {
    setMood(S, "dizzy");
    S.mode = "fall";
    S.travel = false;
    S.fallX = S.pos.x < env.viewport.w / 2 ? bounds(env.size, env.viewport.w, env.viewport.h, env.left).x0 : bounds(env.size, env.viewport.w, env.viewport.h, env.left).x1;
  } else if (impact > CFG.ouchImpact && S.mood !== "dizzy") setMood(S, "ouch", S.t + CFG.ouchFor);
}

function land(S: MotionState, at: Vec2, hooks: Hooks) {
  S.vel = { x: 0, y: 0 };
  S.sqV += 5;
  S.mode = "free";
  S.pinned = true;
  S.anchor = { ...at };
  setMood(S, "dizzy", S.t + CFG.dizzyHold);
  hooks.onPin(S.anchor);
}

export function moodStep(S: MotionState) {
  if (S.mood === "flying" && S.mode !== "toss") setMood(S, "normal");
  if (S.t >= S.moodUntil) {
    if (S.mood === "dizzy") {
      setMood(S, "shake", S.t + CFG.shakeFor);
      S.shakeT = S.t;
    } else if (S.mood === "shake") {
      setMood(S, "happy", S.t + CFG.happyFor);
      S.sqV += 4;
    } else setMood(S, "normal");
  }
  if (S.mood === "normal" && S.mode === "toss" && Math.hypot(S.vel.x, S.vel.y) > CFG.flyingSpeed) setMood(S, "flying");
}

/** Plays the happy face once (a reply finished while minimized) */
export function cheer(S: MotionState) {
  if (S.mood === "dizzy") return;
  setMood(S, "happy", S.t + CFG.happyFor);
  S.sqV += 4;
}

const clampLen = (v: Vec3, max: number): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z);
  return l > max ? { x: (v.x / l) * max, y: (v.y / l) * max, z: (v.z / l) * max } : v;
};

/** Springs that follow the motion: lean, look at the pointer, trailing tentacles, squash, jelly shear, limp, blink */
export function pose(S: MotionState, dt: number, ptr: Pointer) {
  const ease = (rate: number) => 1 - Math.exp(-rate * dt);
  S.lean += (clamp(-S.vel.x * CFG.leanPerPx, -CFG.leanMax, CFG.leanMax) - S.lean) * ease(6);
  const looking = S.t - ptr.lastMove < 4 && ptr.px >= 0;
  const yawT = looking ? clamp((ptr.px - S.pos.x) / 500, -0.55, 0.55) : Math.sin(S.t * 0.23) * 0.15;
  const pitchT = looking ? clamp((ptr.py - S.pos.y) / 700, -0.2, 0.3) : 0.05;
  S.yaw += (yawT - S.yaw) * ease(4);
  S.pitch += (pitchT - S.pitch) * ease(4);

  // Trail: a spring lags the tentacles behind the motion, so they follow through and settle.
  const want = clampLen({ x: -S.vel.x * CFG.trailPerPx, y: clamp(S.vel.y * CFG.trailPerPx, -CFG.trailMax, 0.5), z: 0 }, CFG.trailMax);
  const k = CFG.trailK * dt, f = damp(CFG.trailD, dt);
  S.trailV.x = (S.trailV.x + (want.x - S.trail.x) * k) * f;
  S.trailV.y = (S.trailV.y + (want.y - S.trail.y) * k) * f;
  S.trailV.z = (S.trailV.z + (want.z - S.trail.z) * k) * f;
  S.trail.x += S.trailV.x * dt;
  S.trail.y += S.trailV.y * dt;
  S.trail.z += S.trailV.z * dt;

  S.sqV += (-S.sq * CFG.squashK - S.sqV * CFG.squashD) * dt;
  S.sq += S.sqV * dt;
  const shearT = clamp(-S.vel.x * CFG.shearPerPx, -CFG.shearMax, CFG.shearMax) + Math.sin(S.t * 2.1) * CFG.idleWobble;
  S.shearV += ((shearT - S.shear) * CFG.jellyK - S.shearV * CFG.jellyD) * dt;
  S.shear += S.shearV * dt;
  S.limp += ((S.mood === "dizzy" ? 1 : 0) - S.limp) * ease(CFG.limpRate);

  if (S.t > S.nextBlink) {
    S.blinkT = S.t;
    S.nextBlink = S.t + rand(CFG.blinkMin, CFG.blinkMax);
  }
}
