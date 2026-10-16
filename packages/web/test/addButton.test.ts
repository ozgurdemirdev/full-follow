import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const packages = join(__dirname, "..", "..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(tsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

describe("page add button", () => {
  it("has its style, and no page still uses the dash-new class that has no style", () => {
    const files = sources(packages);
    const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(css).toMatch(/\.add-pill\s*\{[^}]*display:\s*flex/);
    const pages = files.filter((f) => /[\\/]pages[\\/][^\\/]+\.tsx$/.test(f));
    for (const f of pages) expect(readFileSync(f, "utf8"), f).not.toContain("dash-new");
  });
});
