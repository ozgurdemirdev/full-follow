// Jellyfish face: eyes, mouths, blush and dizzy stars, switched by mood. Port of jelly-face.js; colours come from the tokens.
import * as THREE from "three/webgpu";
import { BELL, domePoint } from "./body";
import type { Mood } from "./motion";
import type { FaceColors } from "./palette";

export const FACE = {
  eyeTheta: 1.0, eyePhi: 0.36, eyeR: 0.13, eyeDepth: 0.6, wide: 1.22, squint: 0.25, focus: 0.82,
  mouthTheta: 1.3, mouthWidth: 0.13, mouthCurve: 0.05, stroke: 0.017,
  browLift: 0.24, browSpan: 0.11,
  talkW: 0.12, talkH: 0.15, talkRim: 0.022, talkMin: 0.16,
  blushTheta: 1.2, blushPhi: 0.66, blushW: 0.26, blushH: 0.14,
  stars: 3, starRing: 0.78, starLift: 0.42, starSpin: 1.8, starPop: 10, spiralSpin: 9,
};

type EyeKind = "bead" | "wide" | "squint" | "spiral" | "happy" | "focus";
type MouthKind = "smile" | "o" | "wavy" | "flat" | "talk";
type BrowKind = "browThink" | "browFocus" | "browWorry";
/** What the face shows: a mood, or the look of an activity (packet E) */
export type Look = Mood | "think" | "search" | "work" | "talk" | "error";
// Look -> which eye, mouth and brow variant shows. Moods and activities both pick a look.
const LOOK: Record<Look, { eyes: EyeKind; mouth: MouthKind; brows?: BrowKind }> = {
  normal: { eyes: "bead", mouth: "smile" },
  flying: { eyes: "wide", mouth: "o" },
  ouch: { eyes: "squint", mouth: "wavy" },
  dizzy: { eyes: "spiral", mouth: "wavy" },
  shake: { eyes: "squint", mouth: "wavy" },
  happy: { eyes: "happy", mouth: "smile" },
  think: { eyes: "bead", mouth: "o", brows: "browThink" },
  search: { eyes: "wide", mouth: "o", brows: "browThink" },
  work: { eyes: "focus", mouth: "flat", brows: "browFocus" },
  talk: { eyes: "bead", mouth: "talk" },
  error: { eyes: "bead", mouth: "wavy", brows: "browWorry" },
};

export function surfaceTube(fn: (u: number) => [number, number], segs: number, lift: number, mat: THREE.Material, closed = false, radius: number = FACE.stroke) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= segs; k++) {
    const [th, ph] = fn(k / segs);
    pts.push(domePoint(th, ph, lift).p);
  }
  if (closed) pts.pop();
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), segs * 2, radius, 6, closed), mat);
}

const TEX = 128;
function canvasTexture(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  draw(c.getContext("2d")!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The same colour fully transparent (the gradient end), whatever notation the token uses */
const transparent = (css: string) => `color-mix(in srgb, ${css} 0%, transparent)`;

// A flat decal that faces outward from the dome at (th, ph).
function decal(geo: THREE.BufferGeometry, mat: THREE.Material, th: number, ph: number, lift: number) {
  const { p, n } = domePoint(th, ph, lift);
  const pivot = new THREE.Object3D();
  pivot.position.copy(p);
  pivot.lookAt(p.clone().add(n));
  const mesh = new THREE.Mesh(geo, mat);
  pivot.add(mesh);
  return { pivot, mesh };
}

// D shape with its origin on the top edge, so scaling y only moves the bottom.
function mouthShape(w: number, h: number) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  s.quadraticCurveTo(0, h * 0.15, w, 0);
  s.bezierCurveTo(w * 0.95, -h * 1.3, -w * 0.95, -h * 1.3, -w, 0);
  return new THREE.ShapeGeometry(s, 16);
}

// One brow over the eye on `side`; inner/outer give the height of each end (+ is lower on the dome).
function brow(side: number, inner: number, outer: number, arch: number, lift: number, mat: THREE.Material) {
  const th0 = FACE.eyeTheta - FACE.browLift;
  return surfaceTube((u) => [th0 + inner + (outer - inner) * u - arch * Math.sin(u * Math.PI), side * (FACE.eyePhi - FACE.browSpan + u * FACE.browSpan * 2)], 8, lift, mat);
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.055 : 0.13;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 2 });
  return g.center();
}

export function createFace(bellGroup: THREE.Group, root: THREE.Group, furLength: number, col: FaceColors) {
  Object.assign(FACE, BELL.face);
  const lift = furLength * 0.75;
  const ink = new THREE.MeshStandardMaterial({ color: col.ink, roughness: 0.85 });
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: col.eye, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  const sparkMat = new THREE.MeshBasicMaterial({ color: col.spark });
  const spiralMat = new THREE.MeshBasicMaterial({
    alphaTest: 0.5,
    map: canvasTexture((g) => {
      g.strokeStyle = col.ink;
      g.lineWidth = 9;
      g.lineCap = "round";
      g.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.1) {
        const r = 6 + a * 3;
        g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      g.stroke();
    }),
  });
  const blushMat = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false,
    map: canvasTexture((g) => {
      const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      grd.addColorStop(0, col.blush);
      grd.addColorStop(1, transparent(col.blush));
      g.fillStyle = grd;
      g.fillRect(0, 0, TEX, TEX);
    }),
  });

  const parts: Record<string, THREE.Object3D[]> = { bead: [], wide: [], squint: [], focus: [], spiral: [], happy: [], smile: [], o: [], wavy: [], flat: [], talk: [], browThink: [], browFocus: [], browWorry: [] };
  const beads: THREE.Mesh[] = [], spirals: { mesh: THREE.Mesh }[] = [];
  const eyeGeo = new THREE.SphereGeometry(FACE.eyeR, 24, 16), sparkGeo = new THREE.SphereGeometry(FACE.eyeR * 0.28, 12, 8);
  const discGeo = new THREE.CircleGeometry(FACE.eyeR * 1.2, 32), blushGeo = new THREE.PlaneGeometry(FACE.blushW, FACE.blushH);
  for (const side of [-1, 1]) {
    const { p, n } = domePoint(FACE.eyeTheta, side * FACE.eyePhi, furLength * 0.45);
    const bead = new THREE.Mesh(eyeGeo, eyeMat);
    bead.position.copy(p);
    bead.lookAt(p.clone().add(n));
    bead.scale.set(1, 1, FACE.eyeDepth);
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.set(-0.045, 0.05, FACE.eyeR * 0.9);
    bead.add(spark);
    bellGroup.add(bead);
    beads.push(bead);
    const sp = decal(discGeo, spiralMat, FACE.eyeTheta, side * FACE.eyePhi, furLength * 0.9);
    bellGroup.add(sp.pivot);
    spirals.push(sp);
    parts.spiral.push(sp.pivot);
    parts.happy.push(surfaceTube((u) => [FACE.eyeTheta + 0.05 - 0.1 * Math.sin(u * Math.PI), side * FACE.eyePhi + (u - 0.5) * 0.22], 10, lift, ink));
    // Brows: focus = inner ends down (determined), worry = inner ends up, think = one raised arch.
    parts.browFocus.push(brow(side, 0.07, -0.03, 0, lift, ink));
    parts.browWorry.push(brow(side, -0.05, 0.04, 0, lift, ink));
    parts.browThink.push(side < 0 ? brow(side, -0.06, -0.06, 0.05, lift, ink) : brow(side, 0.01, 0.01, 0, lift, ink));
    const bl = decal(blushGeo, blushMat, FACE.blushTheta, side * FACE.blushPhi, furLength * 0.9);
    bellGroup.add(bl.pivot);
  }
  parts.bead = parts.wide = parts.squint = parts.focus = beads;
  parts.smile.push(surfaceTube((u) => {
    const v = 2 * u - 1;
    return [FACE.mouthTheta + FACE.mouthCurve * (1 - v * v), v * FACE.mouthWidth];
  }, 10, lift, ink));
  parts.o.push(surfaceTube((u) => [FACE.mouthTheta + 0.04 + 0.04 * Math.sin(u * Math.PI * 2), 0.05 * Math.cos(u * Math.PI * 2)], 16, lift, ink, true));
  parts.wavy.push(surfaceTube((u) => {
    const v = 2 * u - 1;
    return [FACE.mouthTheta + 0.025 + 0.022 * Math.sin(v * Math.PI * 1.5), v * FACE.mouthWidth * 1.1];
  }, 16, lift, ink));
  // Determined: a short tight line with one corner up.
  parts.flat.push(surfaceTube((u) => {
    const v = 2 * u - 1;
    return [FACE.mouthTheta + 0.03 - 0.012 * Math.max(0, v) * v, v * FACE.mouthWidth * 0.7];
  }, 8, lift, ink));
  // Talking: a cartoon D mouth (flat top on the smile line, round bottom) with an ink rim and a tongue, above the fur tips;
  // only the bottom moves, so it reads even when small.
  const { p: mp, n: mn } = domePoint(FACE.mouthTheta - 0.01, 0, furLength * 1.3);
  const talkPivot = new THREE.Object3D();
  talkPivot.position.copy(mp);
  talkPivot.lookAt(mp.clone().add(mn));
  const talkMouth = new THREE.Group();
  talkPivot.add(talkMouth);
  const rim = new THREE.Mesh(mouthShape(FACE.talkW + FACE.talkRim, FACE.talkH + FACE.talkRim * 1.6), new THREE.MeshBasicMaterial({ color: col.ink }));
  rim.position.set(0, FACE.talkRim * 0.4, -0.002);
  const tongue = new THREE.Mesh(new THREE.CircleGeometry(FACE.talkW * 0.5, 20), new THREE.MeshBasicMaterial({ color: col.tongue }));
  tongue.position.set(0, -FACE.talkH * 0.72, 0.001);
  tongue.scale.y = 0.55;
  talkMouth.add(rim, new THREE.Mesh(mouthShape(FACE.talkW, FACE.talkH), new THREE.MeshBasicMaterial({ color: col.mouthDark })), tongue);
  parts.talk.push(talkPivot);
  for (const k of Object.keys(parts)) if (k !== "spiral" && k !== "bead" && k !== "wide" && k !== "squint" && k !== "focus") for (const m of parts[k]) bellGroup.add(m);

  const starRing = new THREE.Group();
  starRing.position.y = BELL.Y0 + BELL.H + FACE.starLift;
  const starMat = new THREE.MeshStandardMaterial({ color: col.star, emissive: col.starGlow, emissiveIntensity: 0.9, roughness: 0.45 });
  const starGeo = starGeometry(), stars: THREE.Mesh[] = [];
  for (let i = 0; i < FACE.stars; i++) {
    const a = (i / FACE.stars) * Math.PI * 2, s = new THREE.Mesh(starGeo, starMat);
    s.position.set(Math.sin(a) * FACE.starRing, Math.cos(a * 2) * 0.05, Math.cos(a) * FACE.starRing);
    starRing.add(s);
    stars.push(s);
  }
  root.add(starRing);
  let starScale = 0;
  let current: (typeof LOOK)[Mood] | null = null;

  /** talkOpen: 0 closed to 1 wide open, only used by the talk mouth */
  function update(lookKey: Look, t: number, dt: number, blink: number, talkOpen = 0) {
    const look = LOOK[lookKey] ?? LOOK.normal;
    if (look !== current) {
      current = look;
      for (const [k, list] of Object.entries(parts)) {
        if (k !== "bead" && k !== "wide" && k !== "squint" && k !== "focus") for (const m of list) m.visible = false;
      }
      for (const b of beads) b.visible = look.eyes === "bead" || look.eyes === "wide" || look.eyes === "squint" || look.eyes === "focus";
      for (const m of parts[look.eyes] ?? []) m.visible = true;
      for (const m of parts[look.mouth]) m.visible = true;
      for (const m of look.brows ? parts[look.brows] : []) m.visible = true;
    }
    const sy = (look.eyes === "wide" ? FACE.wide : look.eyes === "squint" ? FACE.squint : look.eyes === "focus" ? FACE.focus : 1) * (look.eyes === "wide" || look.eyes === "squint" ? 1 : blink);
    const sx = look.eyes === "wide" ? FACE.wide : 1;
    for (const b of beads) b.scale.set(sx, sy, FACE.eyeDepth);
    for (const s of spirals) s.mesh.rotation.z -= FACE.spiralSpin * dt;
    talkMouth.scale.set(1 - 0.15 * talkOpen, FACE.talkMin + (1 - FACE.talkMin) * talkOpen, 1);

    starScale += ((lookKey === "dizzy" ? 1 : 0) - starScale) * (1 - Math.exp(-FACE.starPop * dt));
    starRing.visible = starScale > 0.02;
    if (starRing.visible) {
      starRing.rotation.y += FACE.starSpin * dt;
      stars.forEach((s, i) => {
        s.scale.setScalar(starScale);
        s.rotation.y = -starRing.rotation.y;
        s.rotation.z = Math.sin(t * 4 + i) * 0.4;
      });
    }
  }
  return { update };
}
