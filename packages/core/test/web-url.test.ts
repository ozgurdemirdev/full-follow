import { describe, expect, it } from "vitest";
import { zodKit } from "../src";

const { toWebUrl, webUrl, optWebUrl } = zodKit;

describe("web address fields", () => {
  it("keep http and https as given, give a bare domain https, and refuse every other scheme", () => {
    expect(toWebUrl("https://firma.com/ilan?id=3")).toBe("https://firma.com/ilan?id=3");
    expect(toWebUrl("HTTP://firma.com")).toBe("HTTP://firma.com");
    expect(toWebUrl("firma.com")).toBe("https://firma.com");
    expect(toWebUrl("www.firma.com.tr/kariyer")).toBe("https://www.firma.com.tr/kariyer");
    expect(toWebUrl("firma.com:8080/x")).toBe("https://firma.com:8080/x");
    for (const bad of ["javascript:alert(1)", "JavaScript:alert(document.cookie)", "javascript://%0aalert(1)", "data:text/html,<script>alert(1)</script>", "file:///C:/Windows/win.ini", "vbscript:msgbox(1)", "ftp://firma.com", "https://kullanici:sifre@firma.com", "http://", "a b"]) {
      expect(toWebUrl(bad), bad).toBeNull();
    }
  });

  it("the schemas refuse a bad scheme with a validation issue and clear an empty optional value", () => {
    expect(webUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(webUrl.parse(" firma.com ")).toBe("https://firma.com");
    expect(optWebUrl.parse("")).toBeNull();
    expect(optWebUrl.parse(null)).toBeNull();
    expect(optWebUrl.safeParse("data:text/html,x").success).toBe(false);
  });
});
