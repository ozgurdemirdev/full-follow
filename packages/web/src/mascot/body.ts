// Jellyfish body: felt fur material, bell, tentacles. Shape comes from the active variant. Port of jelly-body.js.
import * as THREE from "three/webgpu";
import { attribute, float, instanceIndex, max, mix, mx_noise_float, normalLocal, positionLocal, smoothstep, step, uniform, varying } from "three/tsl";
import { BELL_BUILD, CFG, TENT_BUILD, VARIANTS, type BellShape, type FaceShape, type TentShape } from "./config";

export const BELL: BellShape & { segments: number; domeSteps: number; lipSteps: number; rimFade: number; face: FaceShape } = {
  ...VARIANTS.yuvarlak.bell, ...BELL_BUILD, face: VARIANTS.yuvarlak.face,
};
export const TENT: TentShape & { rings: number; capRings: number; radial: number } & Omit<typeof TENT_BUILD, "rings" | "capRings" | "radial"> = { ...VARIANTS.yuvarlak.tent, ...TENT_BUILD };

export function applyVariant(id: string) {
  const v = VARIANTS[id] ?? VARIANTS.yuvarlak;
  Object.assign(BELL, v.bell, { face: v.face });
  Object.assign(TENT, v.tent);
}

/** Shader inputs shared by the fur material; colours are written by scene.ts */
export const U = {
  bell: uniform(new THREE.Color()), tent: uniform(new THREE.Color()), glow: uniform(new THREE.Color()),
  glowPow: uniform(1), shells: uniform(CFG.shellsMax), furLen: uniform(0.04), freq: uniform(40), force: uniform(new THREE.Vector3(0, -0.5, 0)),
};

/** Where a tentacle is asked to reach (root local) and how strongly, 0 to 1 */
export interface Reach { x: number; y: number; z: number; w: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function domePoint(th: number, ph = 0, lift = 0) {
  const r = BELL.R * Math.sin(th), y = BELL.Y0 + BELL.H * Math.pow(Math.cos(th), BELL.P);
  const p = new THREE.Vector3(r * Math.sin(ph), y, r * Math.cos(ph));
  const n = new THREE.Vector3(p.x / BELL.R ** 2, (y - BELL.Y0) / BELL.H ** 2, p.z / BELL.R ** 2).normalize();
  return { p: p.addScaledVector(n, lift), n };
}

/** Extent of the whole model, for camera framing */
export function extent() {
  return { top: BELL.Y0 + BELL.H, bottom: TENT.rootY - TENT.lenMax, width: BELL.R * (1 + 0.07 * BELL.flare) + TENT.lenMax * 0.45 };
}

/** Shell count is a uniform so it can drop for small sizes without a rebuild (mesh.count follows it) */
export function furMaterial({ furLength, furFreq, glowStrength }: { furLength: number; furFreq: number; glowStrength: number }) {
  U.furLen.value = furLength;
  U.freq.value = furFreq;
  const hVert: any = float(instanceIndex).div(U.shells.sub(1));
  const h: any = varying(hVert);
  const fc: any = attribute("furCoord", "vec3");
  const glowA: any = attribute("glow", "float");
  const m: any = new THREE.MeshPhysicalNodeMaterial({ roughness: 0.93, metalness: 0, sheenRoughness: 0.45 });
  m.positionNode = positionLocal.add(normalLocal.mul(hVert.mul(U.furLen))).add(U.force.mul(hVert.mul(hVert).mul(U.furLen)));
  const n1: any = mx_noise_float(fc.mul(U.freq)).mul(0.5).add(0.5);
  const n2: any = mx_noise_float(fc.mul(U.freq.mul(2.7)).add(13.1)).mul(0.5).add(0.5);
  const len: any = n1.mul(0.55).add(n2.mul(0.45)).mul(1.7);
  m.opacityNode = max(smoothstep(h, h.add(0.12), len), float(1).sub(step(0.001, h)));
  m.alphaTest = 0.5;
  const base: any = mix(U.bell, U.tent, smoothstep(0.4, 0.6, glowA));
  m.colorNode = base.mul(mix(0.72, 1.12, h).mul(mix(0.96, 1.03, n2)));
  m.sheenNode = base.mul(0.45);
  m.emissiveNode = mix(U.glow, U.bell, 0.2).mul(glowA).mul(U.glowPow).mul(glowStrength).mul(mix(0.6, 1.0, h));
  return m as THREE.MeshPhysicalNodeMaterial;
}

export function buildBell() {
  const { R, Y0, flare } = BELL;
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= BELL.domeSteps; i++) {
    const p = domePoint((i / BELL.domeSteps) * Math.PI / 2).p;
    profile.push(new THREE.Vector2(Math.hypot(p.x, p.z), p.y));
  }
  // Soft rounded lip that tucks under; flare = 0 gives a plain rounded edge with no ring.
  const lip = new THREE.SplineCurve([
    new THREE.Vector2(R, Y0), new THREE.Vector2(R * (1 + 0.05 * flare), Y0 - 0.08), new THREE.Vector2(R * (1 + 0.06 * flare) - 0.02, Y0 - 0.15),
    new THREE.Vector2(R * 0.9, Y0 - 0.2), new THREE.Vector2(R * 0.65, Y0 - 0.19), new THREE.Vector2(R * 0.35, Y0 - 0.16), new THREE.Vector2(0.001, Y0 - 0.15),
  ]).getPoints(BELL.lipSteps).slice(1);
  const pts = profile.concat(lip);
  // Seam at the back (phiStart = PI), away from the camera.
  let geo = new THREE.LatheGeometry(pts, BELL.segments, Math.PI);
  const n0 = geo.attributes.normal, p0 = geo.attributes.position, i = 10;
  if (p0.getX(i) * n0.getX(i) + (p0.getY(i) - Y0) * n0.getY(i) + p0.getZ(i) * n0.getZ(i) < 0) {
    geo.dispose();
    geo = new THREE.LatheGeometry(pts.reverse(), BELL.segments, Math.PI);
  }
  const pos = geo.attributes.position, cnt = pos.count, glow = new Float32Array(cnt);
  for (let k = 0; k < cnt; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), r = Math.hypot(x, z);
    const w = THREE.MathUtils.smoothstep(Y0 + BELL.rimFade - y, 0, BELL.rimFade) * Math.min(1, r / R);
    const s = 1 + BELL.lobeDepth * w * Math.cos(BELL.lobes * Math.atan2(x, z));
    pos.setXYZ(k, x * s, y, z * s);
    glow[k] = y < Y0 - 0.1 ? 0.22 : 0;
  }
  geo.computeVertexNormals();
  geo.setAttribute("furCoord", new THREE.BufferAttribute((pos.array as Float32Array).slice(), 3));
  geo.setAttribute("glow", new THREE.BufferAttribute(glow, 1));
  return geo;
}

export interface Tentacle {
  i: number; ik?: THREE.Vector3[]; ikLive?: boolean;
  out: THREE.Vector3; side: THREE.Vector3; len: number; r0: number; phase: number; phase2: number; splay: number; curl: number;
}

/** Tentacles: one merged dynamic geometry, rebuilt on the CPU each frame from per-tentacle centerlines */
export function createTentacles() {
  const RINGS = TENT.rings + TENT.capRings, R = TENT.radial, N = TENT.count;
  const tents: Tentacle[] = [];
  for (let i = 0; i < N; i++) {
    const phi = ((i + 0.5) / N) * Math.PI * 2;
    const out = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi));
    tents.push({
      i, out, side: new THREE.Vector3(out.z, 0, -out.x), len: rand(TENT.lenMin, TENT.lenMax), r0: rand(TENT.rMin, TENT.rMax),
      phase: rand(0, 6.28), phase2: rand(0, 6.28), splay: rand(TENT.splayMin, TENT.splayMax), curl: rand(TENT.curlMin, TENT.curlMax),
    });
  }
  const vCount = N * RINGS * R;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(vCount * 3), 3));
  geo.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(vCount).fill(1), 1));
  const idx: number[] = [];
  for (let i = 0; i < N; i++) {
    const base = i * RINGS * R;
    for (let j = 0; j < RINGS - 1; j++) {
      for (let k = 0; k < R; k++) {
        const a = base + j * R + k, b = base + j * R + (k + 1) % R;
        idx.push(a, b, a + R, b, b + R, a + R);
      }
    }
  }
  geo.setIndex(idx);

  const cl = Array.from({ length: TENT.rings }, () => new THREE.Vector3());
  const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3();
  const DOWN = new THREE.Vector3(0, -1, 0);
  const ik = Array.from({ length: TENT.rings }, () => new THREE.Vector3()), _v = new THREE.Vector3(), _tg = new THREE.Vector3();

  // FABRIK from the free pose toward `target`, root fixed; segments may stretch (jelly) up to TENT.stretch.
  function reachTo(target: THREE.Vector3, seg0: number, w: number, td: Tentacle) {
    const n = TENT.rings;
    // Warm start from last frame's solution so the chain does not jump between frames.
    const prev = td.ik ?? (td.ik = Array.from({ length: n }, () => new THREE.Vector3()));
    const warm = td.ikLive;
    for (let j = 0; j < n; j++) ik[j].copy(warm ? prev[j] : cl[j]);
    // A target inside the bell (chin, glasses) would fight the collision every frame; rest it on the surface.
    pushOut(target);
    const seg = Math.min(Math.max(seg0, cl[0].distanceTo(target) / (n - 1)), seg0 * TENT.stretch);
    for (let it = 0; it < TENT.ikIterations; it++) {
      ik[n - 1].copy(target);
      for (let j = n - 2; j >= 0; j--) {
        _v.subVectors(ik[j], ik[j + 1]).setLength(seg);
        ik[j].copy(ik[j + 1]).add(_v);
      }
      ik[0].copy(cl[0]);
      for (let j = 1; j < n; j++) {
        _v.subVectors(ik[j], ik[j - 1]).setLength(seg);
        ik[j].copy(ik[j - 1]).add(_v);
        if (j >= TENT.collideFrom) pushOut(ik[j]);
      }
    }
    if (warm) for (let j = 1; j < n; j++) ik[j].lerp(prev[j], TENT.ikSmooth);
    ik[0].copy(cl[0]);
    for (let j = 0; j < n; j++) prev[j].copy(ik[j]);
    td.ikLive = true;
    for (let j = 1; j < n; j++) {
      cl[j].lerp(ik[j], w * Math.min(1, (j / (n - 1)) * 3));
      if (j >= TENT.collideFrom) pushOut(cl[j]);
    }
  }

  // Keeps a centerline point outside the bell, modelled as one continuous shape: a tall half ellipsoid above the lip and a flat one
  // below it, joined at the lip. Continuous on purpose: a rule with two exits flips between them and makes the tentacle jitter.
  function pushOut(p: THREE.Vector3) {
    const m = TENT.rMax + TENT.collideMargin, rc = BELL.R * (1 + 0.07 * BELL.flare) + m;
    const cy = BELL.Y0 - TENT.lipBand, dy = p.y - cy;
    const ry = dy >= 0 ? BELL.H + TENT.lipBand + m : TENT.lipBand + m;
    const d = Math.hypot(Math.hypot(p.x, p.z) / rc, dy / ry);
    if (d < 1) {
      const k = 1 / Math.max(d, 1e-4);
      p.x *= k;
      p.z *= k;
      p.y = cy + dy * k;
    }
  }

  /** reach: optional array, one { x, y, z, w } per tentacle (root-local target and weight 0..1) */
  function write(t: number, trail: THREE.Vector3, c: number, limp: number, live = true, reach: Reach[] | null = null) {
    const arr = geo.attributes.position.array as Float32Array;
    const lively = live ? 1 - 0.75 * limp : 0;
    let o = 0;
    for (const td of tents) {
      const seg = td.len / (TENT.rings - 1);
      const rootR = TENT.rootR * (1 - 0.1 * c);
      cl[0].set(td.out.x * rootR, TENT.rootY, td.out.z * rootR);
      for (let j = 1; j < TENT.rings; j++) {
        const s = j / (TENT.rings - 1);
        const sway = Math.sin(t * 2.0 - s * 4 + td.phase) * TENT.sway * s * lively;
        const swing = Math.sin(t * 1.4 - s * 3 + td.phase2) * TENT.swing * s * lively;
        const outK = td.splay * (1 - 0.6 * limp) - c * 0.3 + swing;
        _d.copy(DOWN).addScaledVector(td.out, outK).addScaledVector(td.side, sway).addScaledVector(trail, 0.3 + 1.4 * s).normalize();
        // Tip curls outward and up; limp tentacles hang straighter.
        const k = Math.max(0, (s - 0.55) / 0.45);
        if (k > 0) _d.applyAxisAngle(td.side, -td.curl * k * k * (1 - 0.5 * limp)).normalize();
        cl[j].copy(cl[j - 1]).addScaledVector(_d, seg);
      }
      const r = reach?.[td.i];
      if (r && r.w > 0.001) reachTo(_tg.set(r.x, r.y, r.z), seg, r.w, td);
      else td.ikLive = false;
      // Parallel-transport frames so rings never twist.
      _n.copy(td.out);
      for (let j = 0; j < RINGS; j++) {
        const jj = Math.min(j, TENT.rings - 1);
        _t.copy(cl[Math.min(jj + 1, TENT.rings - 1)]).sub(cl[Math.max(jj - 1, 0)]).normalize();
        if (j < TENT.rings) _n.addScaledVector(_t, -_n.dot(_t)).normalize();
        _b.crossVectors(_t, _n);
        let rad: number;
        if (j < TENT.rings) {
          rad = td.r0 * (1 - TENT.taper * (j / (TENT.rings - 1)));
          _c.copy(cl[j]);
        } else {
          const a = ((j - TENT.rings + 1) / TENT.capRings) * Math.PI / 2, rEnd = td.r0 * (1 - TENT.taper);
          rad = rEnd * Math.cos(a);
          _c.copy(cl[TENT.rings - 1]).addScaledVector(_t, rEnd * Math.sin(a));
        }
        for (let q = 0; q < R; q++) {
          const a = (q / R) * Math.PI * 2, ca = Math.cos(a) * rad, sa = Math.sin(a) * rad;
          arr[o++] = _c.x + _n.x * ca + _b.x * sa;
          arr[o++] = _c.y + _n.y * ca + _b.y * sa;
          arr[o++] = _c.z + _n.z * ca + _b.z * sa;
        }
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  write(0, new THREE.Vector3(), 0, 0, false);
  geo.setAttribute("furCoord", new THREE.BufferAttribute((geo.attributes.position.array as Float32Array).slice(), 3));
  return { geo, write, tents };
}
