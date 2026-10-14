import { Suspense } from "react";
import { useRegistry } from "./registry";

/**
 * An extension point: renders the component every installed, visible module registered under `name` (manifest `slots`), in order,
 * each with the same `props`. Nothing renders when no module fills it, so a screen never knows which modules exist.
 */
export function Slot({ name, props }: { name: string; props?: object }) {
  const entries = useRegistry().slot(name);
  return (
    <>
      {entries.map(({ key, Component }) => (
        <Suspense key={key} fallback={null}>
          <Component {...props} />
        </Suspense>
      ))}
    </>
  );
}
