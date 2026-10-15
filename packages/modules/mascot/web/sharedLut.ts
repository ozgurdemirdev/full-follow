import * as THREE from "three/webgpu";

/** Name three gives its one shared DFG lookup texture (every renderer of the page uses it) */
const SHARED_LUT_NAME = "DFG_LUT";

/**
 * three keeps one DFG lookup texture for the whole page, and every renderer hangs a dispose listener on it that only the
 * texture's own dispose removes: a disposed renderer (its scene, buffers and canvas) would stay reachable from it, one more
 * per time the mascot is shown. The texture is noted when a listener is added so `releaseSharedLut` can dispose it.
 */
let sharedLut: THREE.Texture | null = null;
const addListener = THREE.EventDispatcher.prototype.addEventListener;
THREE.EventDispatcher.prototype.addEventListener = function (this: THREE.Texture, ...args: Parameters<typeof addListener>) {
  if (this.isTexture && this.name === SHARED_LUT_NAME) sharedLut = this;
  return addListener.apply(this, args);
} as typeof addListener;

/** Runs the dispose listeners of the shared texture, which drops them. Call it before `renderer.dispose()`: that forgets the renderer's texture records, and a listener that finds none cannot remove itself. */
export function releaseSharedLut() {
  sharedLut?.dispose();
}
