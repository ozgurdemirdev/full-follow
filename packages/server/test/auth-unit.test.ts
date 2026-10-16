import { describe, expect, it, vi } from "vitest";

// timingSafeEqual is wrapped so a test can see the length of what the password check compares
const compared = vi.hoisted(() => [] as number[]);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return {
    ...real,
    default: real,
    timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
      compared.push(a.byteLength, b.byteLength);
      return real.timingSafeEqual(a, b);
    },
  };
});

const { safeEqual } = await import("../src/auth");

describe("password comparison", () => {
  it("compares digests of one fixed length, so a wrong length is not refused before the constant time compare", () => {
    compared.length = 0;
    expect(safeEqual("short", "a much longer secret value")).toBe(false);
    expect(safeEqual("same value", "same value")).toBe(true);
    expect(safeEqual("şifre", "sifre")).toBe(false);
    expect(compared).toEqual([32, 32, 32, 32, 32, 32]);
  });
});
