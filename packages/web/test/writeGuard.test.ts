import { afterEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/api/actions";
import { endpointOn, loadModules, setEndpointOwners } from "../src/api/modules";

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("a write to a module that is not installed", () => {
  it("is refused before any request is sent, like the reads", async () => {
    setEndpointOwners(() => [["/tasks", "calendar"], ["/people", "people"]]);
    const fetcher = vi.fn(async (url: string) => (url.endsWith("/modules") ? json([{ key: "people" }]) : json({ modules_hidden: [] })));
    vi.stubGlobal("fetch", fetcher);
    await loadModules();
    fetcher.mockClear();

    expect(endpointOn("/tasks")).toBe(false);
    expect(endpointOn("/tasks/12")).toBe(false);
    expect(endpointOn("/people?limit=5")).toBe(true);
    await expect(run("post", "/tasks", { title: "x" }, { silent: true })).rejects.toMatchObject({ status: 404, code: "module_off" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
