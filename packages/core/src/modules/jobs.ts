import type { JobApp, JobDef } from "./types";

/**
 * Starts the jobs of the installed modules and returns the function that stops them.
 * A job that is still running when its next tick comes is skipped, never run twice at once; a failing run is logged and the schedule goes on.
 * The timers never keep the process alive.
 */
export function startJobs(jobs: JobDef[], app: JobApp, warn: (line: string) => void = console.warn): () => void {
  const timers: NodeJS.Timeout[] = [];
  for (const job of jobs) {
    if (job.enabled && !job.enabled()) continue;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await job.run(app);
      } catch (e) {
        warn(`  ${job.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        running = false;
      }
    };
    timers.push(setTimeout(tick, job.firstRunMs ?? job.everyMs).unref(), setInterval(tick, job.everyMs).unref());
  }
  return () => timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
}
