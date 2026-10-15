import * as THREE from "three/webgpu";
import { describe, expect, it } from "vitest";
import { releaseSharedLut } from "../web/sharedLut";

const texture = (name: string) => {
  const t = new THREE.DataTexture(new Uint16Array(2), 1, 1, THREE.RGFormat, THREE.HalfFloatType);
  t.name = name;
  return t;
};
/** What the renderer's texture manager does with a texture it draws: a dispose listener that removes itself */
const hangListener = (t: THREE.Texture) => {
  const state = { ran: 0 };
  const onDispose = () => {
    state.ran++;
    t.removeEventListener("dispose", onDispose);
  };
  t.addEventListener("dispose", onDispose);
  return { state, onDispose };
};

describe("releaseSharedLut", () => {
  it("runs the dispose listener a renderer left on the shared lookup texture, which removes it", () => {
    const lut = texture("DFG_LUT");
    const { state, onDispose } = hangListener(lut);
    releaseSharedLut();
    expect(state.ran).toBe(1);
    expect(lut.hasEventListener("dispose", onDispose)).toBe(false);
  });

  it("leaves any other texture alone", () => {
    const other = texture("map");
    const { state } = hangListener(other);
    releaseSharedLut();
    expect(state.ran).toBe(0);
  });
});
