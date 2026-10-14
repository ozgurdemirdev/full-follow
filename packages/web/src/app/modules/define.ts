// Kept apart from the registry on purpose: a manifest imports this file, the registry imports the manifests (modules.generated.ts),
// so this file must never import the registry.
import type { WebModule } from "./types";

/** Declares a module's web part: `export default defineWebModule({ key: "calendar", label: "Takvim", routes: [...], ... })` */
export const defineWebModule = (manifest: WebModule): WebModule => manifest;
