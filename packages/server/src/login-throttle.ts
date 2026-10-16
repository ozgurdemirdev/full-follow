import { LOGIN_LOCKOUT_MAX_MS, LOGIN_LOCKOUT_MEMORY_MS, LOGIN_MAX_ATTEMPTS, LOGIN_TRACKED_MAX, LOGIN_WINDOW_MS } from "./constants";

interface Entry {
  /** wrong passwords inside the current window */
  n: number;
  /** when the current window of wrong passwords ends */
  windowEnd: number;
  /** lockouts so far: each one doubles the next */
  lockouts: number;
  /** no login is checked before this time, not even the right password */
  lockedUntil: number;
}

/**
 * Wrong logins per address. LOGIN_MAX_ATTEMPTS wrong passwords inside the window lock the address for the window; each
 * further lockout within LOGIN_LOCKOUT_MEMORY_MS doubles the lock (up to LOGIN_LOCKOUT_MAX_MS). The map is bounded:
 * entries are forgotten once nothing about them is still running, and the oldest go first past LOGIN_TRACKED_MAX.
 */
export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  /** the sweep runs at most once a window, so a flood of wrong logins does not walk the map on every request */
  private nextSweep = 0;

  /** How many addresses are remembered right now */
  get size() {
    return this.entries.size;
  }

  locked(ip: string, now = Date.now()): boolean {
    return (this.entries.get(ip)?.lockedUntil ?? 0) > now;
  }

  failed(ip: string, now = Date.now()): void {
    this.sweep(now);
    const e = this.entries.get(ip) ?? { n: 0, windowEnd: 0, lockouts: 0, lockedUntil: 0 };
    e.n = (e.windowEnd > now ? e.n : 0) + 1;
    e.windowEnd = now + LOGIN_WINDOW_MS;
    if (e.n >= LOGIN_MAX_ATTEMPTS) {
      e.lockedUntil = now + Math.min(LOGIN_WINDOW_MS * 2 ** e.lockouts, LOGIN_LOCKOUT_MAX_MS);
      e.lockouts++;
      e.n = 0;
    }
    this.entries.delete(ip);
    this.entries.set(ip, e);
    while (this.entries.size > LOGIN_TRACKED_MAX) this.entries.delete(this.entries.keys().next().value!);
  }

  succeeded(ip: string): void {
    this.entries.delete(ip);
  }

  private sweep(now: number) {
    if (now < this.nextSweep) return;
    this.nextSweep = now + LOGIN_WINDOW_MS;
    for (const [ip, e] of this.entries) {
      if (Math.max(e.windowEnd, e.lockedUntil) + (e.lockouts ? LOGIN_LOCKOUT_MEMORY_MS : 0) <= now) this.entries.delete(ip);
    }
  }
}
