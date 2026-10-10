import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

// Animasyon özellikleri ayrı parça olarak bir kez yüklenir (promise önbellekte)
let features: Promise<typeof import("motion/react").domAnimation> | undefined;
const load = () => (features ??= import("../app/motionFeatures").then((m) => m.default));

/** Motion kullanan her ada kendi kapsamını taşır; böylece Motion ana pakete girmez, ilk ihtiyaçta yüklenir */
export function MotionScope({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={load} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
