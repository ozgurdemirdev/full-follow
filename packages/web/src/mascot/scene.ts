// Everything that touches Three.js besides body.ts and face.ts: renderer, lights, model, camera framing, per frame pose.
// Loaded lazily by Mascot.tsx (a separate chunk), never from the entry.
import * as THREE from "three/webgpu";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { applyVariant, BELL, buildBell, createTentacles, extent, furMaterial, U } from "./body";
import { CAMERA_FOV, CFG, MAX_DT } from "./config";
import { createFace } from "./face";
import { clamp, type MotionState } from "./motion";
import { faceColors, type BellGlow } from "./palette";

export interface SceneOptions {
  /** element carrying the token custom properties (the mascot root) */
  tokens: Element;
  variant: string;
  colors: BellGlow;
}
export interface RenderStats {
  drawCalls: number;
  triangles: number;
}
export interface MascotScene {
  backend: "WebGPU" | "WebGL 2";
  setVariant(id: string): void;
  setColors(c: BellGlow): void;
  resize(w: number, h: number): void;
  /** poses the model from the motion state and draws one frame */
  frame(S: MotionState, dt: number, glowScale: number): void;
  stats(): RenderStats | null;
  /** run `fn` every display frame, or stop with null */
  loop(fn: ((dt: number) => void) | null): void;
  dispose(): void;
}

const _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _shear = new THREE.Matrix4(), _trail = new THREE.Vector3();

export async function createMascotScene(canvas: HTMLCanvasElement, opts: SceneOptions): Promise<MascotScene> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.max(devicePixelRatio, CFG.supersample));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CFG.exposure;
  await renderer.init();
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 1, 20);
  const face0 = faceColors(opts.tokens);
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = CFG.envIntensity;
  } catch {
    scene.add(new THREE.HemisphereLight(face0.lightKey, face0.ink, 1.2));
  }
  const key = new THREE.DirectionalLight(face0.lightKey, 2.2);
  key.position.set(-2.5, 3, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(face0.lightRim, 1.6);
  rim.position.set(2, 1.5, -3);
  scene.add(rim);
  const furMat = furMaterial(CFG);

  let root: THREE.Group | null = null;
  let bellGroup: THREE.Group;
  let tentacles: ReturnType<typeof createTentacles>;
  let face: ReturnType<typeof createFace>;
  let glowLight: THREE.PointLight;
  let colors = opts.colors;

  // Fits the camera to the model, leaving room above for the dizzy stars.
  function frameModel() {
    if (!root) return;
    const e = extent(), top = e.top + CFG.frameTop, bottom = e.bottom - CFG.frameBottom;
    root.position.y = -(top + bottom) / 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max((top - bottom) / 2 / tan, (e.width + CFG.frameSide) / (tan * camera.aspect));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
  }

  function applyColors() {
    U.bell.value.set(colors.bell);
    U.glow.value.set(colors.glow);
    U.tent.value.set(colors.bell).lerp(new THREE.Color(colors.glow), 0.5);
    glowLight?.color.set(colors.glow);
  }

  // Rebuilds bell, tentacles and face for the variant; the fur material is shared and kept.
  function buildModel(variant: string) {
    if (root) {
      scene.remove(root);
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material & { map?: THREE.Texture } | undefined;
        if (mat && mat !== furMat) {
          mat.map?.dispose();
          mat.dispose();
        }
      });
    }
    applyVariant(variant);
    root = new THREE.Group();
    scene.add(root);
    bellGroup = new THREE.Group();
    bellGroup.matrixAutoUpdate = false;
    root.add(bellGroup);
    bellGroup.add(new THREE.InstancedMesh(buildBell(), furMat, CFG.shells));
    tentacles = createTentacles();
    const tentMesh = new THREE.InstancedMesh(tentacles.geo, furMat, CFG.shells);
    tentMesh.frustumCulled = false;
    root.add(tentMesh);
    face = createFace(bellGroup, root, CFG.furLength, face0);
    glowLight = new THREE.PointLight(colors.glow, 4, 3.5, 2);
    glowLight.position.set(0, BELL.Y0 - 0.45, 0.35);
    root.add(glowLight);
    applyColors();
    frameModel();
  }

  buildModel(opts.variant);
  await renderer.compileAsync(scene, camera);

  return {
    backend: (renderer as unknown as { backend: { isWebGPUBackend?: boolean } }).backend.isWebGPUBackend ? "WebGPU" : "WebGL 2",
    setVariant: buildModel,
    setColors(c) {
      colors = c;
      applyColors();
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameModel();
    },
    frame(S, dt, glowScale) {
      if (!root) return;
      const bl = S.t - S.blinkT < CFG.blinkLen ? 0.12 : 1;
      face.update(S.mood, S.t, Math.min(dt, MAX_DT), bl);
      // Dizzy: slow drunken sway. Shake: fast decaying head shake.
      let wobY = Math.sin(S.t * 2.3) * 0.3 * S.limp;
      const wobZ = Math.sin(S.t * 3.1) * 0.16 * S.limp;
      if (S.mood === "shake") {
        const k = (S.t - S.shakeT) / CFG.shakeFor;
        wobY += Math.sin(k * CFG.shakeFor * CFG.shakeFreq) * CFG.shakeAmp * (1 - k);
      }
      root.rotation.set(S.pitch, S.yaw + wobY, S.lean + wobZ);
      const c = S.c, sq = clamp(S.sq, -0.5, 0.6);
      bellGroup.matrix.makeScale(1 - 0.1 * c + 0.18 * sq, 1 + 0.07 * c - 0.25 * sq, 1 - 0.1 * c + 0.18 * sq)
        .premultiply(_shear.makeShear(0, 0, clamp(S.shear, -CFG.shearMax, CFG.shearMax), 0, 0, 0));
      bellGroup.matrixWorldNeedsUpdate = true;
      _trail.set(S.trail.x, S.trail.y, S.trail.z);
      tentacles.write(S.t, _trail, c, S.limp);
      _d.set(0, -0.5, 0).applyQuaternion(_q.copy(root.quaternion).invert()).addScaledVector(_trail, 0.6);
      U.force.value.copy(_d);
      U.glowPow.value = (0.85 + 0.35 * c) * (1 - 0.3 * S.limp) * glowScale;
      renderer.render(scene, camera);
    },
    stats() {
      const info = renderer.info.render as unknown as { drawCalls?: number; calls?: number; triangles: number };
      return { drawCalls: info.drawCalls ?? info.calls ?? 0, triangles: info.triangles };
    },
    loop(fn) {
      let last = performance.now();
      renderer.setAnimationLoop(fn ? () => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, MAX_DT);
        last = now;
        fn(dt);
      } : null);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
  };
}
