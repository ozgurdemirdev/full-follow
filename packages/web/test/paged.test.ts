import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("../src/api/client", async (original) => ({ ...(await original<typeof import("../src/api/client")>()), api: { get: (...a: unknown[]) => get(...a) } }));

const { drainPages, withPaging } = await import("../src/api/paged");

/** A server with `total` rows that answers `limit` and `offset` like the list routes */
const server = (total: number, extra: object = {}) => async (path: string) => {
  const q = new URL(path, "http://x").searchParams;
  const limit = Number(q.get("limit"));
  const offset = Number(q.get("offset") ?? 0);
  return { rows: Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({ id: offset + i + 1 })), total, ...extra };
};

beforeEach(() => get.mockReset());

describe("withPaging", () => {
  it("adds the page to a path with or without a query", () => {
    expect(withPaging("/people", 40, 80)).toBe("/people?limit=40&offset=80");
    expect(withPaging("/people?q=ada", 40, 0)).toBe("/people?q=ada&limit=40&offset=0");
  });
});

describe("drainPages", () => {
  it("reads every row past the first page, never asking for more than a page, and keeps the extras of the first answer", async () => {
    get.mockImplementation(server(450, { meta: "rules" }));
    const all = await drainPages<{ id: number }, { meta: string }>("/opportunities?board=true", 200);
    expect(all.rows).toHaveLength(450);
    expect(all.total).toBe(450);
    expect(all.meta).toBe("rules");
    expect(new Set(all.rows.map((r) => r.id)).size).toBe(450);
    const asked = get.mock.calls.map((c) => c[0] as string);
    expect(asked).toEqual(["/opportunities?board=true&limit=200&offset=0", "/opportunities?board=true&limit=200&offset=200", "/opportunities?board=true&limit=200&offset=400"]);
  });

  it("is one request when the list fits a page, and stops when a page comes back empty", async () => {
    get.mockImplementation(server(3));
    expect((await drainPages("/tags", 200)).rows).toHaveLength(3);
    expect(get).toHaveBeenCalledTimes(1);

    get.mockReset();
    // a server that claims more rows than it will give must not make the loop spin
    get.mockImplementation(async (...args: unknown[]) => (String(args[0]).includes("offset=0") ? { rows: [{ id: 1 }], total: 5 } : { rows: [], total: 5 }));
    expect((await drainPages("/odd", 200)).rows).toHaveLength(1);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
