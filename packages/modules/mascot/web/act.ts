// Jellyfish acting: props and poses that show what the chat is doing without any text. Port of jelly-act.js; colours come from the tokens.
// Imports three, so it lives in the lazy 3D chunk with scene.ts. The activity names and the chat mapping are in activity.ts.
import * as THREE from "three/webgpu";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Activity } from "./activity";
import { BELL, domePoint, U, type Reach, type Tentacle } from "./body";
import { ACT } from "./config";
import { FACE, surfaceTube, type Look } from "./face";
import type { PropColors } from "./palette";

/** Activity -> face look (null = the mood decides) */
const ACT_LOOK: Record<Activity, Look | null> = { idle: null, queued: null, thinking: "think", search: "search", work: "work", writing: "talk", error: "error" };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const sstep = THREE.MathUtils.smoothstep;
const ease = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const backOut = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

/** Picks the free tentacle pointing most along (dx, dz) in the body frame. */
function pick(tents: Tentacle[], dx: number, dz: number, used: Set<number>) {
  let best = 0, bd = -Infinity;
  for (const t of tents) {
    if (used.has(t.i)) continue;
    const d = t.out.x * dx + t.out.z * dz;
    if (d > bd) {
      bd = d;
      best = t.i;
    }
  }
  used.add(best);
  return best;
}

function buildLaptop(root: THREE.Group, col: PropColors) {
  const L = ACT.lap;
  const alu = new THREE.MeshStandardMaterial({ color: col.alu, metalness: 1, roughness: 0.38 });
  const lap = new THREE.Group();
  lap.add(new THREE.Mesh(new RoundedBoxGeometry(L.w, L.t, L.d, 3, L.round), alu));
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(L.w * 0.84, L.d * 0.42), new THREE.MeshStandardMaterial({ color: col.keys, roughness: 0.7 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, L.t / 2 + 0.002, L.d * 0.12);
  lap.add(keys);
  const hinge = new THREE.Group();
  hinge.position.set(0, L.t / 2, L.d / 2);
  lap.add(hinge);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(L.w, L.lidH, L.lidT, 3, L.round), alu);
  lid.position.y = L.lidH / 2;
  hinge.add(lid);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(L.w * 0.88, L.lidH * 0.82), new THREE.MeshBasicMaterial({ color: col.screen }));
  screen.position.set(0, L.lidH / 2, -L.lidT / 2 - 0.003);
  screen.rotation.y = Math.PI;
  hinge.add(screen);
  const logoMat = new THREE.MeshBasicNodeMaterial();
  logoMat.colorNode = U.glow;
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), logoMat);
  logo.position.set(0, L.lidH * 0.55, L.lidT / 2 + 0.003);
  hinge.add(logo);
  // Screen glow on the face.
  const lamp = new THREE.PointLight(col.screenLight, 0, 1.8, 2);
  lamp.position.set(0, L.lidH * 0.5, -0.3);
  hinge.add(lamp);
  root.add(lap);
  return { lap, hinge, lamp };
}

function buildGlasses(bellGroup: THREE.Group, furLength: number, col: PropColors) {
  const lift = furLength * 0.45 + 0.09;
  const frameMat = new THREE.MeshStandardMaterial({ color: col.frame, roughness: 0.35 });
  const lensMat = new THREE.MeshBasicMaterial({ color: col.lens, transparent: true, opacity: ACT.lensOpacity, depthWrite: false });
  const ringR = FACE.eyeR * 1.45, ringPhi = ringR / (BELL.R * Math.sin(FACE.eyeTheta));
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const { p, n } = domePoint(FACE.eyeTheta, side * FACE.eyePhi, lift);
    const pivot = new THREE.Object3D();
    pivot.position.copy(p);
    pivot.lookAt(p.clone().add(n));
    pivot.add(new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.016, 8, 36), frameMat));
    pivot.add(new THREE.Mesh(new THREE.CircleGeometry(ringR * 0.98, 32), lensMat));
    g.add(pivot);
    g.add(surfaceTube((u) => [FACE.eyeTheta - 0.02, side * (FACE.eyePhi + ringPhi + u * 0.55)], 8, lift - 0.04, frameMat, false, 0.013));
  }
  const inner = FACE.eyePhi - ringPhi;
  g.add(surfaceTube((u) => [FACE.eyeTheta - 0.03 - 0.03 * Math.sin(u * Math.PI), (u * 2 - 1) * inner], 8, lift, frameMat, false, 0.014));
  bellGroup.add(g);
  return { g, lensMat, bridge: domePoint(FACE.eyeTheta - 0.06, 0, lift).p };
}

function buildMagnifier(root: THREE.Group, col: PropColors) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 40), new THREE.MeshStandardMaterial({ color: col.brass, metalness: 1, roughness: 0.3 })));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.155, 32), new THREE.MeshBasicMaterial({ color: col.screen, transparent: true, opacity: 0.25, depthWrite: false })));
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.2, 6, 12), new THREE.MeshStandardMaterial({ color: col.handle, roughness: 0.6 }));
  handle.position.y = -0.3;
  g.add(handle);
  root.add(g);
  return g;
}

function buildDots(root: THREE.Group, col: PropColors) {
  const top = BELL.Y0 + BELL.H, mat = new THREE.MeshBasicMaterial({ color: col.dot });
  return [[0.62, 0.12, 0.05], [0.82, 0.3, 0.065], [1.0, 0.5, 0.08]].map(([x, y, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    m.position.set(x, top + y, 0.3);
    root.add(m);
    return m;
  });
}

// Speech bubble with three hopping dots: says "talking" even at the smallest size.
function buildBubble(root: THREE.Group, col: PropColors) {
  const w = 0.24, h = 0.15, r = 0.1, s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(-w * 0.35, -h);
  s.lineTo(-w * 0.75, -h - 0.11);
  s.lineTo(-w * 0.55, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.ShapeGeometry(s, 8), new THREE.MeshBasicMaterial({ color: col.dot })));
  const ink = new THREE.MeshBasicMaterial({ color: col.ink });
  const dots = [-0.1, 0, 0.1].map((x) => {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), ink);
    d.position.set(x, 0, 0.003);
    g.add(d);
    return d;
  });
  g.position.set(0.82, BELL.Y0 + BELL.H + 0.12, 0.35);
  root.add(g);
  return { g, dots };
}

function buildDrop(bellGroup: THREE.Group, col: PropColors) {
  const pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI / 2;
    pts.push(new THREE.Vector2(0.05 * Math.sin(a), -0.05 * Math.cos(a)));
  }
  pts.push(new THREE.Vector2(0.036, 0.035), new THREE.Vector2(0.016, 0.075), new THREE.Vector2(0.001, 0.095));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), new THREE.MeshStandardMaterial({ color: col.drop, emissive: col.drop, emissiveIntensity: 0.25, roughness: 0.1, transparent: true }));
  bellGroup.add(m);
  return m;
}

/** Per frame inputs from outside the rig */
export interface ActInput {
  /** laptop, magnifier and glasses are shown (false below ACT_PROPS_MIN_SIZE) */
  props: boolean;
  /** no typing bounce and no magnifier sweep */
  reduce: boolean;
}
export interface ActOutput {
  reach: Reach[];
  look: Look | null;
  pitch: number;
  yaw: number;
  /** extra squash kick this frame (typing, talking) */
  kick: number;
  /** talk mouth opening, 0 to 1 */
  talk: number;
}

export function createActing(root: THREE.Group, bellGroup: THREE.Group, tents: Tentacle[], furLength: number, col: PropColors) {
  const used = new Set<number>();
  const typers = [pick(tents, 0.3, 1, used), pick(tents, -0.3, 1, used)];
  const holders = [pick(tents, 0.8, 0.6, used), pick(tents, -0.8, 0.6, used)];
  const helper = pick(tents, 1, 0.2, used);
  const reach: Reach[] = tents.map(() => ({ x: 0, y: 0, z: 0, w: 0 }));
  const { lap, hinge, lamp } = buildLaptop(root, col);
  const glasses = buildGlasses(bellGroup, furLength, col);
  const mag = buildMagnifier(root, col);
  const dots = buildDots(root, col);
  const drop = buildDrop(bellGroup, col);
  const bubble = buildBubble(root, col);
  const keys = typers.map((_, k) => ({ ph: k * 0.5, prev: 0, x: 0, z: 0.1 }));
  const p = { lap: 0, glasses: 0, mag: 0, dots: 0, drop: 0, bubble: 0 };
  let talk = 0, talkTarget = 0, glassesOn = false;
  const v = new THREE.Vector3();
  const L = ACT.lap;
  const set = (i: number, vec: THREE.Vector3, w: number) => {
    reach[i].x = vec.x;
    reach[i].y = vec.y;
    reach[i].z = vec.z;
    reach[i].w = w;
  };
  const toRoot = (local: THREE.Vector3, obj: THREE.Object3D) => v.copy(local).applyMatrix4(obj.matrix);

  function update(act: Activity, t: number, dt: number, t0: number, inp: ActInput): ActOutput {
    for (const r of reach) r.w = 0;
    const out: ActOutput = { reach, look: ACT_LOOK[act], pitch: 0, yaw: 0, kick: 0, talk: 0 };
    p.lap += ((inp.props && act === "work" ? 1 : 0) - p.lap) * ease(ACT.pop, dt);
    glassesOn = inp.props && act === "work" && p.lap > 0.6;
    p.glasses += ((glassesOn ? 1 : 0) - p.glasses) * ease(ACT.glassesRate, dt);
    p.mag += ((inp.props && act === "search" ? 1 : 0) - p.mag) * ease(ACT.pop, dt);
    p.dots += ((act === "thinking" ? 1 : 0) - p.dots) * ease(ACT.pop, dt);
    p.drop += ((act === "error" ? 1 : 0) - p.drop) * ease(ACT.pop, dt);
    p.bubble += ((act === "writing" ? 1 : 0) - p.bubble) * ease(ACT.pop, dt);

    // Laptop: pops up, lid opens, two tentacles hold it, two type hard and fast.
    lap.visible = p.lap > 0.01;
    if (lap.visible) {
      const e = backOut(Math.min(1, p.lap * 1.5));
      lap.position.set(L.x, L.y - L.rise * (1 - e), L.z);
      lap.rotation.set(0, L.yaw, 0);
      lap.scale.setScalar(Math.max(0.001, e));
      hinge.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, L.lidOpen, sstep(p.lap, 0.55, 1));
      lamp.intensity = ACT.screenLightMax * sstep(p.lap, 0.6, 1);
      lap.updateMatrix();
      const hold = sstep(p.lap, 0.2, 0.7), type = sstep(p.lap, 0.6, 1);
      holders.forEach((i, k) => set(i, toRoot(v.set((k ? -1 : 1) * 0.33, -L.t / 2 - 0.01, -0.12), lap), hold));
      typers.forEach((i, k) => {
        const s = keys[k];
        if (!inp.reduce) s.ph += dt * ACT.typeHz;
        const f = s.ph % 1;
        if (s.prev < 0.5 && f >= 0.5) {
          s.x = (k ? -1 : 1) * rand(0.03, 0.34);
          s.z = rand(0, 0.2);
        }
        if (f < s.prev && type > 0.9) out.kick += ACT.keyKick;
        s.prev = f;
        const lift = ACT.keyLift * (0.5 - 0.5 * Math.cos(f * Math.PI * 2));
        set(i, toRoot(v.set(s.x, L.t / 2 + 0.02 + lift, s.z), lap), type);
      });
      out.pitch += 0.1 * sstep(p.lap, 0.5, 1);
    }

    // Glasses come up on the helper tentacle, which lets go once they sit.
    glasses.g.visible = p.glasses > 0.01;
    if (glasses.g.visible) {
      const e = sstep(p.glasses, 0, 1);
      // Put on: they come up from below. Take off: the tentacle lifts them away to the side.
      if (glassesOn) glasses.g.position.set(0, -0.55 * (1 - e), 0.35 * (1 - e));
      else glasses.g.position.set(0.55 * (1 - e), 0.35 * (1 - e), 0.25 * (1 - e));
      glasses.g.scale.setScalar(0.4 + 0.6 * e);
      glasses.lensMat.opacity = ACT.lensOpacity + 0.12 * lamp.intensity / ACT.screenLightMax;
      set(helper, v.copy(glasses.bridge).add(glasses.g.position).applyMatrix4(bellGroup.matrix), Math.min(1, 6.4 * p.glasses * (1 - p.glasses)));
    }

    // Thinking: dots over the head, a tentacle on the chin, eyes up.
    dots.forEach((d, i) => {
      const s = sstep(p.dots, i * 0.2, i * 0.2 + 0.4);
      d.visible = s > 0.01;
      d.scale.setScalar(s * (0.75 + 0.25 * Math.sin(t * 5 - i * 0.9)));
    });
    if (p.dots > 0.01) {
      set(helper, v.copy(domePoint(1.45, 0.25, 0.08).p).applyMatrix4(bellGroup.matrix), sstep(p.dots, 0, 1));
      out.pitch -= 0.14 * p.dots;
      out.yaw += 0.18 * p.dots;
    }

    // Search: a magnifier sweeps across the face, the head follows it.
    mag.visible = p.mag > 0.01;
    if (mag.visible) {
      const eye = domePoint(FACE.eyeTheta, 0).p, sweep = inp.reduce ? 0 : Math.sin(t * 1.4);
      mag.position.set(0.3 * sweep, eye.y, 1.35);
      mag.scale.setScalar(sstep(p.mag, 0, 1));
      set(helper, v.set(mag.position.x, eye.y - 0.38, 1.3), sstep(p.mag, 0, 1));
      out.yaw += 0.2 * sweep * p.mag;
    }

    // Error: a sweat drop slides down the side of the head.
    drop.visible = p.drop > 0.01;
    if (drop.visible) {
      const k = (t * 0.75) % 1, a = domePoint(0.7 + 0.4 * k, 0.95, 0.06).p;
      drop.position.copy(a);
      drop.scale.setScalar(p.drop * (1 - sstep(k, 0.75, 1)));
    }

    bubble.g.visible = p.bubble > 0.01;
    if (bubble.g.visible) {
      bubble.g.scale.setScalar(backOut(Math.min(1, p.bubble * 1.4)));
      bubble.dots.forEach((d, i) => {
        d.position.y = 0.035 * Math.max(0, Math.sin(t * 9 - i * 0.9));
      });
    }

    if (act === "queued") out.pitch += 0.22 * Math.sin(Math.PI * Math.min(1, (t - t0) / 0.55));
    if (act === "writing") {
      const phrase = (t * 0.42) % 1;
      const target = phrase > 0.86 ? 0 : Math.min(1, Math.abs(Math.sin(t * ACT.talkRate)) * (0.55 + 0.45 * Math.sin(t * 2.3 + Math.sin(t * 5.1))) * 1.1);
      if (talkTarget < 0.55 && target >= 0.55) out.kick += ACT.talkKick;
      talkTarget = target;
      talk += (target - talk) * ease(ACT.talkSmooth, dt);
      out.pitch += 0.035 * talk;
      out.yaw += 0.06 * Math.sin(t * 0.7);
    } else talk = 0;
    out.talk = talk;
    return out;
  }
  return { update };
}
