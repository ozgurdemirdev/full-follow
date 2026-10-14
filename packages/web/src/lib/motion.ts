// Motion (JS animasyon) değerleri de tokens.json'dan gelir; adlandırılmış içe aktarma sayesinde
// pakete sadece "motion" bölümü girer.
import { motion as M } from "../styles/tokens.json";

const bezier = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number, number];
const sec = (s: string) => parseFloat(s) / 1000;

export const ease = { out: bezier(M.ease.out), pop: bezier(M.ease.pop), leave: bezier(M.ease.leave) };
export const dur = Object.fromEntries(Object.entries(M.duration).map(([k, v]) => [k, sec(v)])) as Record<keyof typeof M.duration, number>;
export const riseY = parseFloat(M["rise-distance"]);
export const overlayRise = parseFloat(M["overlay-rise"]);
export const stagger = sec(M["stagger-step"]);
