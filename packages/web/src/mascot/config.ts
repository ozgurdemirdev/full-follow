// Mascot tuning: every number lives here, by name (port of docs/design/maskot/jelly-config.js and the variants of jelly-body.js). No colours: those come from the tokens.
const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

export const CFG = {
  shells: coarse ? 16 : 24, furLength: 0.04, furFreq: 40, glowStrength: 0.9, exposure: 0.85, envIntensity: 0.35,
  // The canvas is tiny, so it is always supersampled at 2x: alpha-tested fur needs it and the cost is about 140 k pixels.
  supersample: 2,
  pulseTravel: 1.5, pulseIdle: 3.2, impulse: 95, waterDrag: 1.4, tossDrag: 0.9, maxToss: 2400,
  restitution: 0.55, settleSpeed: 25, idleMin: 3, idleMax: 9, arrive: 36,
  holdK: 14, holdD: 6, dragK: 260, dragTap: 6,
  leanPerPx: 0.0011, leanMax: 0.5, trailPerPx: 0.0011, trailMax: 1.1, trailK: 40, trailD: 8,
  squashK: 160, squashD: 5, blinkMin: 2, blinkMax: 6, blinkLen: 0.12, bob: 3,
  // Jelly: the bell shears behind the motion on a soft spring and keeps wobbling after it stops.
  jellyK: 110, jellyD: 4, shearPerPx: 0.00045, shearMax: 0.45, idleWobble: 0.03, impactShear: 0.0006,
  frameTop: 0.6, frameBottom: 0.12, frameSide: 0.2,
  // Moods: hard hits stun it, it drops to the nearest bottom corner, stays dizzy, shakes it off, smiles.
  flyingSpeed: 380, ouchImpact: 320, dizzyImpact: 750, ouchFor: 0.4,
  gravity: 1500, fallPull: 4, fallDragX: 2.2, landSpeed: 260, fallBounce: 0.35,
  dizzyHold: 2.6, shakeFor: 0.8, shakeFreq: 19, shakeAmp: 0.4, happyFor: 1.4, limpRate: 4,
  /** pulse speed while idle or reduced motion */
  reducedPulse: 0.4,
} as const;

// Canvas width in px; height follows the model aspect.
export const SIZE = { min: 56, max: 180, step: 2, initial: 96, aspect: 1.05, phoneScale: 0.8 } as const;

/** No input for this long and the mascot starts wandering again */
export const MASCOT_IDLE_MS = 20_000;
/** A press that moves less than this many px is a click */
export const DRAG_THRESHOLD = CFG.dragTap;
/** Packet C: where the mascot perches on the chat window, as fractions of its size */
export const PERCH_X = 0.6;
export const PERCH_Y = 0.35;

export const CAMERA_FOV = 30;
/** Squeezed between obstacles and walls it shrinks to this fraction of its size, quickly, and grows back slowly (rates per second) */
export const SQUEEZE_MIN = 0.5;
export const SQUEEZE_IN = 9;
export const SQUEEZE_OUT = 1.4;
/** Largest simulation step (s), so a long frame never explodes the springs */
export const MAX_DT = 1 / 30;
/** Fade in and out of the mascot element (modal dialogs, tab changes) */
export const FADE_CLASS = "is-faded";

export interface BellShape { R: number; H: number; Y0: number; P: number; flare: number; lobes: number; lobeDepth: number }
export interface TentShape {
  count: number; lenMin: number; lenMax: number; rMin: number; rMax: number; taper: number; rootR: number; rootY: number;
  splayMin: number; splayMax: number; curlMin: number; curlMax: number; sway: number; swing: number;
}
export interface FaceShape { eyeTheta: number; eyePhi: number; eyeR: number; mouthTheta: number; blushTheta: number; blushPhi: number }
export interface Variant { name: string; bell: BellShape; tent: TentShape; face: FaceShape }

// Bell dome: radius R sin(th), height Y0 + H cos(th)^P. Below the rim the lip tucks under (flare pushes it out).
// Face angles are measured on the same dome, so each variant places its own face.
export const VARIANTS: Record<string, Variant> = {
  yuvarlak: {
    name: "Yuvarlak",
    bell: { R: 1.0, H: 0.98, Y0: 0.3, P: 0.9, flare: 0, lobes: 8, lobeDepth: 0.025 },
    tent: { count: 8, lenMin: 0.5, lenMax: 0.7, rMin: 0.15, rMax: 0.17, taper: 0.15, rootR: 0.6, rootY: 0.18, splayMin: 0.55, splayMax: 0.75, curlMin: 0.5, curlMax: 0.9, sway: 0.12, swing: 0.1 },
    face: { eyeTheta: 1.12, eyePhi: 0.34, eyeR: 0.15, mouthTheta: 1.36, blushTheta: 1.3, blushPhi: 0.62 },
  },
  klasik: {
    name: "Klasik",
    bell: { R: 1.0, H: 0.85, Y0: 0.25, P: 0.95, flare: 0.5, lobes: 8, lobeDepth: 0 },
    tent: { count: 8, lenMin: 0.8, lenMax: 1.0, rMin: 0.15, rMax: 0.17, taper: 0.25, rootR: 0.58, rootY: 0.12, splayMin: 0.35, splayMax: 0.5, curlMin: 0.7, curlMax: 1.1, sway: 0.14, swing: 0.1 },
    face: { eyeTheta: 1.05, eyePhi: 0.36, eyeR: 0.13, mouthTheta: 1.28, blushTheta: 1.22, blushPhi: 0.64 },
  },
  etekli: {
    name: "Etekli",
    bell: { R: 1.0, H: 0.95, Y0: 0.3, P: 0.9, flare: 0.3, lobes: 12, lobeDepth: 0.07 },
    tent: { count: 12, lenMin: 0.55, lenMax: 0.85, rMin: 0.075, rMax: 0.09, taper: 0.3, rootR: 0.48, rootY: 0.16, splayMin: 0.22, splayMax: 0.4, curlMin: 1.2, curlMax: 2.0, sway: 0.3, swing: 0.14 },
    face: { eyeTheta: 1.12, eyePhi: 0.34, eyeR: 0.15, mouthTheta: 1.36, blushTheta: 1.3, blushPhi: 0.62 },
  },
};
export const VARIANT_IDS = Object.keys(VARIANTS);
export const DEFAULT_VARIANT = "etekli";

export const BELL_BUILD = { segments: 60, rimFade: 0.25 } as const;
export const TENT_BUILD = { rings: 22, capRings: 5, radial: 12 } as const;
