import type { ComponentProps } from "react";
import { useAutosave } from "../../lib/settings";
import { NumberField } from "../NumberField";
import { Skeleton } from "../ui";

type Save<T> = { save: (value: T) => Promise<unknown>; settle: () => Promise<unknown> };

/** Placeholder of a control whose data is still loading: same size as the pill it becomes */
export const ControlSkeleton = () => <Skeleton className="h-stepper-height w-settings-input-width rounded-pill" />;

/** Pill stepper that saves itself. An emptied field is not sent (it falls back), unless `nullable`: then empty means 0 */
export function AutoNumber({ server, save, settle, label, nullable, ...field }: Save<number> & {
  server: number | null;
  label: string;
  nullable?: boolean;
} & Pick<ComponentProps<typeof NumberField>, "min" | "max" | "step" | "prefix" | "suffix" | "placeholder">) {
  const [value, change] = useAutosave<number | null>(server, async (n) => (n === null && !nullable ? undefined : save(n ?? 0)), settle);
  return <NumberField stepper value={value} onChange={change} ariaLabel={label} {...field} />;
}

/** Pill input (text or date) that saves itself */
export function AutoText({ server, save, settle, label, ...input }: Save<string> & {
  server: string;
  label: string;
} & Pick<ComponentProps<"input">, "type" | "placeholder" | "maxLength">) {
  const [value, change] = useAutosave(server, save, settle);
  return <input className="set-input" aria-label={label} autoComplete="off" value={value} onChange={(e) => change(e.target.value)} {...input} />;
}
