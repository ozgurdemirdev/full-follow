import { rhythmLevel } from "../people";

/** Weekly touch rhythm as bars (oldest week first); the colour is the warmth set on a parent as data-warm */
export function Rhythm({ weeks, large = false }: { weeks: number[]; large?: boolean }) {
  return (
    <span className={`ppl-spark ${large ? "is-lg" : ""}`} aria-hidden="true">
      {weeks.map((n, i) => <i key={i} data-l={rhythmLevel(n)} />)}
    </span>
  );
}
