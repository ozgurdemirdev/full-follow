import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { brotliCompressSync, constants as zc, gzipSync } from "node:zlib";
import { defineConfig, type Plugin } from "vite";

const require = createRequire(import.meta.url);
const pkgDir = (name: string) => dirname(require.resolve(`${name}/package.json`));

const tokens = JSON.parse(readFileSync(new URL("./src/styles/tokens.json", import.meta.url), "utf8"));

/** index.html içindeki %TOKEN% yer tutucularını tokens.json'dan doldurur */
const htmlTokens = (): Plugin => ({
  name: "html-tokens",
  transformIndexHtml: (html) => html.replace("%THEME_COLOR%", tokens.color.bg.canvas),
});

/** Derleme sonunda metin dosyalarının .br ve .gz kopyalarını üretir; sunucu bunları hazır gönderir */
const precompress = (): Plugin => {
  let outDir = "dist";
  return {
    name: "precompress",
    apply: "build",
    configResolved: (c) => void (outDir = c.build.outDir),
    closeBundle() {
      const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
      for (const f of walk(outDir).filter((f) => /\.(js|css|html|svg|json)$/.test(f))) {
        const buf = readFileSync(f);
        if (buf.length < 1024) continue;
        writeFileSync(`${f}.br`, brotliCompressSync(buf, { params: { [zc.BROTLI_PARAM_QUALITY]: 11 } }));
        writeFileSync(`${f}.gz`, gzipSync(buf, { level: 9 }));
      }
    },
  };
};

// React Compiler: bileşenleri derleme anında otomatik memoize eder (gereksiz yeniden çizim yok, çalışma anı maliyeti yok)
export default defineConfig({
  plugins: [htmlTokens(), react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), precompress()],
  resolve: {
    alias: { "@geist": pkgDir("@fontsource-variable/geist"), "@geist-mono": pkgDir("@fontsource-variable/geist-mono") },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    cssMinify: "lightningcss",
    reportCompressedSize: true,
    chunkSizeWarningLimit: 250,
  },
});
