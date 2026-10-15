import { beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn();
const toast = vi.fn();
vi.mock("../src/api/actions", () => ({ run: (...a: unknown[]) => run(...a) }));
vi.mock("../src/components/toast", () => ({ toast: (...a: unknown[]) => toast(...a) }));

const { ensureCompany, ensurePerson, optionalStep } = await import("../src/forms/helpers");

beforeEach(() => {
  run.mockReset();
  toast.mockReset();
});

describe("records made on the way to a save", () => {
  it("the new person and company are written back as soon as they exist, so a retry reuses them", async () => {
    run.mockImplementation(async (_m: string, path: string) => ({ row: { id: path === "/companies" ? 7 : 9 } }));
    const person: unknown[] = [];
    const company: unknown[] = [];
    const id = await ensurePerson(
      { id: null, text: " Ayşe Yılmaz " },
      { company: { id: null, text: "Acme" } },
      { person: (r) => person.push(r), company: (r) => company.push(r) },
    );
    expect(id).toBe(9);
    expect(company).toEqual([{ id: 7, text: "Acme" }]);
    expect(person).toEqual([{ id: 9, text: "Ayşe Yılmaz" }]);

    // the form now holds the ids: sending it again creates nothing
    run.mockClear();
    expect(await ensurePerson({ id: 9, text: "Ayşe Yılmaz" }, { company: { id: 7, text: "Acme" } })).toBe(9);
    expect(await ensureCompany({ id: 7, text: "Acme" })).toBe(7);
    expect(run).not.toHaveBeenCalled();
  });

  it("a company made before a failed person save stays written back", async () => {
    run.mockImplementation(async (_m: string, path: string) => {
      if (path === "/companies") return { row: { id: 7 } };
      throw new Error("down");
    });
    const company: unknown[] = [];
    await expect(ensurePerson({ id: null, text: "Ayşe" }, { company: { id: null, text: "Acme" } }, { company: (r) => company.push(r) })).rejects.toThrow("down");
    expect(company).toEqual([{ id: 7, text: "Acme" }]);
  });
});

describe("optional steps after the main save", () => {
  it("a failure is a toast naming the part, never a thrown error", async () => {
    await expect(optionalStep(async () => { throw new Error("down"); }, "ilk yorum eklenemedi")).resolves.toBeUndefined();
    expect(toast).toHaveBeenCalledWith("ilk yorum eklenemedi", "error");
  });

  it("says nothing when it worked", async () => {
    await optionalStep(async () => "ok", "x");
    expect(toast).not.toHaveBeenCalled();
  });
});
