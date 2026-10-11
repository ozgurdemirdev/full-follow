// Colours come from the design tokens at runtime (the CSS custom properties set on the mascot element, see mascot.css),
// so this file holds no colour literals.
export const PRESET_IDS = ["amber", "mercan", "lila", "lagun", "nane"] as const;
export type PresetId = (typeof PRESET_IDS)[number];
export type ColorChoice = PresetId | "custom";

export const PRESET_NAMES: Record<PresetId, string> = { amber: "Amber", mercan: "Mercan", lila: "Lila", lagun: "Lagün", nane: "Nane" };

export interface BellGlow {
  bell: string;
  glow: string;
}
export interface FaceColors {
  ink: string; eye: string; spark: string; star: string; starGlow: string; blush: string;
  lightKey: string; lightRim: string; mouthDark: string; tongue: string;
}
/** Colours of the acting props (laptop, glasses, magnifier, speech bubble, sweat drop) */
export interface PropColors {
  alu: string; keys: string; screen: string; screenLight: string; frame: string; lens: string; brass: string; handle: string; drop: string; dot: string; ink: string;
}

const read = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(`--mascot-${name}`).trim();

export function presetColors(el: Element, id: PresetId): BellGlow {
  return { bell: read(el, `${id}-bell`), glow: read(el, `${id}-glow`) };
}

export function faceColors(el: Element): FaceColors {
  return {
    ink: read(el, "ink"), eye: read(el, "eye"), spark: read(el, "spark"), star: read(el, "star"), starGlow: read(el, "star-glow"),
    blush: read(el, "blush"), lightKey: read(el, "light-key"), lightRim: read(el, "light-rim"), mouthDark: read(el, "mouth-dark"), tongue: read(el, "tongue"),
  };
}

export function propColors(el: Element): PropColors {
  return {
    alu: read(el, "alu"), keys: read(el, "keys"), screen: read(el, "screen"), screenLight: read(el, "screen-light"), frame: read(el, "frame"),
    lens: read(el, "lens"), brass: read(el, "brass"), handle: read(el, "handle"), drop: read(el, "drop"), dot: read(el, "dot"), ink: read(el, "ink"),
  };
}

/** The glow colour that goes with a custom bell colour: the bell colour pulled toward the custom-mix token (mix amount as in the prototype) */
export const CUSTOM_MIX_AMOUNT = 0.4;
export const customMix = (el: Element) => read(el, "custom-mix");
