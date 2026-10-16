import { describe, expect, it } from "vitest";
import { m } from "../src/messages";

describe("panel Claude's system rules", () => {
  it("name the owner once a name is set, and speak of the user without one", () => {
    expect(m.systemRules("Ayşe").split("\n")[0]).toContain("Kullanıcının adı Ayşe");
    const neutral = m.systemRules(null);
    expect(neutral.split("\n")[0]).toContain("Kullanıcıyla Türkçe");
    expect(neutral).not.toMatch(/Özgür/);
  });
});
