import { describe, expect, it } from "vitest";
import { LOGIN_LOCKOUT_MAX_MS, LOGIN_LOCKOUT_MEMORY_MS, LOGIN_MAX_ATTEMPTS, LOGIN_TRACKED_MAX, LOGIN_WINDOW_MS } from "../src/constants";
import { LoginThrottle } from "../src/login-throttle";

const fail = (t: LoginThrottle, ip: string, times: number, now: number) => {
  for (let i = 0; i < times; i++) t.failed(ip, now);
};

describe("login throttle", () => {
  it("locks an address after the wrong attempts for one window, then doubles the lock on each further lockout up to the cap", () => {
    const t = new LoginThrottle();
    let now = 1_000_000;
    fail(t, "a", LOGIN_MAX_ATTEMPTS - 1, now);
    expect(t.locked("a", now)).toBe(false);
    fail(t, "a", 1, now);
    expect(t.locked("a", now)).toBe(true);
    expect(t.locked("a", now + LOGIN_WINDOW_MS)).toBe(false);

    now += LOGIN_WINDOW_MS;
    fail(t, "a", LOGIN_MAX_ATTEMPTS, now);
    expect(t.locked("a", now + LOGIN_WINDOW_MS)).toBe(true);
    expect(t.locked("a", now + 2 * LOGIN_WINDOW_MS)).toBe(false);

    for (let i = 0; i < 12; i++) {
      now += LOGIN_LOCKOUT_MAX_MS;
      fail(t, "a", LOGIN_MAX_ATTEMPTS, now);
    }
    expect(t.locked("a", now + LOGIN_LOCKOUT_MAX_MS - 1)).toBe(true);
    expect(t.locked("a", now + LOGIN_LOCKOUT_MAX_MS)).toBe(false);
    expect(t.locked("b", now)).toBe(false);
  });

  it("a right login clears the address, and lockouts are forgotten after the memory period", () => {
    const t = new LoginThrottle();
    const now = 5_000_000;
    fail(t, "a", LOGIN_MAX_ATTEMPTS, now);
    const later = now + LOGIN_WINDOW_MS + LOGIN_LOCKOUT_MEMORY_MS;
    fail(t, "a", LOGIN_MAX_ATTEMPTS, later);
    expect(t.locked("a", later + LOGIN_WINDOW_MS)).toBe(false);
    t.succeeded("a");
    expect(t.size).toBe(0);
  });

  it("stays bounded: finished entries are evicted and the oldest go first past the cap", () => {
    const t = new LoginThrottle();
    const now = 9_000_000;
    for (let i = 0; i < 100; i++) t.failed(`old${i}`, now);
    t.failed("fresh", now + LOGIN_WINDOW_MS);
    expect(t.size).toBe(1);
    for (let i = 0; i < LOGIN_TRACKED_MAX + 50; i++) t.failed(`ip${i}`, now + LOGIN_WINDOW_MS);
    expect(t.size).toBe(LOGIN_TRACKED_MAX);
  });
});
