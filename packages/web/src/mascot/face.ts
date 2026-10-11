// Jellyfish face: eyes, mouths, blush and dizzy stars, switched by mood. Port of jelly-face.js; colours come from the tokens.
import * as THREE from "three/webgpu";
import { BELL, domePoint } from "./body";
import type { Mood } from "./motion";
import type { FaceColors } from "./palette";

const FACE = {
  eyeTheta: 1.0, eyePhi: 0.36, eyeR: 0.13, eyeDepth: 0.6, wide: 1.22, squint: 0.25,
  mouthTheta: 1.3, mouthWidth: 0.13, mouthCurve: 0.05, stroke: 0.017,
  blushTheta: 1.2, blushPhi: 0.66, blushW: 0.26, blushH: 0.14,
  stars: 3, starRing: 0.78, starLift: 0.42, starSpin: 1.8, starPop: 10, spiralSpin: 9,
};

type EyeKind = "bead" | "wide" | "squint" | "spiral" | "happy";
type MouthKind = "smile" | "o" | "wavy";
// Mood -> which eye and mouth variant shows.
const LOOK: Record<Mood, { eyes: EyeKind; mouth: MouthKind }> = {
  normal: { eyes: "bead", mouth: "smile" },
  flying: { eyes: "wide", mouth: "o" },
  ouch: { eyes: "squint", mouth: "wavy" },
  dizzy: { eyes: "spiral", mouth: "wavy" },
  shake: { eyes: "squint", mouth: "wavy" },
  happy: { eyes: "happy", mouth: "smile" },
};

function surfaceTube(fn: (u: number) => [number, number], segs: number, lift: number, mat: THREE.Material, closed = false) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= segs; k++) {
    const [th, ph] = fn(k / segs);
    pts.push(domePoint(th, ph, lift).p);
  }
  if (closed) pts.pop();
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), segs * 2, FACE.stroke, 6, closed), mat);
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

  const parts: Record<string, THREE.Object3D[]> = { bead: [], wide: [], squint: [], spiral: [], happy: [], smile: [], o: [], wavy: [] };
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
    const bl = decal(blushGeo, blushMat, FACE.blushTheta, side * FACE.blushPhi, furLength * 0.9);
    bellGroup.add(bl.pivot);
  }
  parts.bead = parts.wide = parts.squint = beads;
  parts.smile.push(surfaceTube((u) => {
    const v = 2 * u - 1;
    return [FACE.mouthTheta + FACE.mouthCurve * (1 - v * v), v * FACE.mouthWidth];
  }, 10, lift, ink));
  parts.o.push(surfaceTube((u) => [FACE.mouthTheta + 0.04 + 0.04 * Math.sin(u * Math.PI * 2), 0.05 * Math.cos(u * Math.PI * 2)], 16, lift, ink, true));
  parts.wavy.push(surfaceTube((u) => {
    const v = 2 * u - 1;
    return [FACE.mouthTheta + 0.025 + 0.022 * Math.sin(v * Math.PI * 1.5), v * FACE.mouthWidth * 1.1];
  }, 16, lift, ink));
  for (const k of ["happy", "smile", "o", "wavy"]) for (const m of parts[k]) bellGroup.add(m);

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

  function update(mood: Mood, t: number, dt: number, blink: number) {
    const look = LOOK[mood] ?? LOOK.normal;
    if (look !== current) {
      current = look;
      for (const [k, list] of Object.entries(parts)) {
        if (k !== "bead" && k !== "wide" && k !== "squint") for (const m of list) m.visible = false;
      }
      for (const b of beads) b.visible = look.eyes === "bead" || look.eyes === "wide" || look.eyes === "squint";
      for (const m of parts[look.eyes] ?? []) m.visible = true;
      for (const m of parts[look.mouth]) m.visible = true;
    }
    const sy = look.eyes === "wide" ? FACE.wide : look.eyes === "squint" ? FACE.squint : blink;
    const sx = look.eyes === "wide" ? FACE.wide : 1;
    for (const b of beads) b.scale.set(sx, sy, FACE.eyeDepth);
    for (const s of spirals) s.mesh.rotation.z -= FACE.spiralSpin * dt;

    starScale += ((mood === "dizzy" ? 1 : 0) - starScale) * (1 - Math.exp(-FACE.starPop * dt));
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
