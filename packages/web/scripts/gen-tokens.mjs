// tokens.json → src/styles/tokens.css
// Tasarım token'larının tek kaynağı tokens.json'dur. Bu betik onları Tailwind v4 @theme
// değişkenlerine (hem CSS değişkeni hem yardımcı sınıf olur) ve birkaç @utility'ye çevirir.
// Tailwind'in varsayılan renk, boşluk, yazı, gölge ölçekleri kapatılır: sadece token'lar vardır.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../src/styles/tokens.json");
const out = resolve(here, "../src/styles/tokens.css");
const t = JSON.parse(readFileSync(src, "utf8"));

const theme = [];
const colors = [];
const root = [];
const utils = [];
const v = (name, value) => theme.push(`  --${name}: ${value};`);
const key = (k) => String(k).replace(/\./g, "_");

/** İç içe nesneyi düzleştirir; "default" anahtarı adı uzatmaz */
function flat(obj, prefix, emit) {
  for (const [k, val] of Object.entries(obj)) {
    const name = k === "default" ? prefix : `${prefix}-${key(k)}`;
    if (val && typeof val === "object") flat(val, name, emit);
    else emit(name, val);
  }
}

// varsayılan ölçekleri kapat
for (const ns of ["color", "font", "text", "font-weight", "leading", "tracking", "spacing", "radius", "shadow", "ease", "breakpoint", "container", "animate", "inset-shadow", "drop-shadow", "blur"]) {
  theme.push(`  --${ns}-*: initial;`);
}

// Two level colours: the palette holds raw values (private CSS variables only, no Tailwind
// utilities); semantic entries reference them as "{palette.<key>}". Mascot colours stay raw.
const PALETTE_REF = /^\{palette\.([^}]+)\}$/;
const resolvePalette = (name, val) => {
  const m = PALETTE_REF.exec(val);
  if (!m) return val;
  if (!(m[1] in t.palette)) throw new Error(`tokens.json: unknown palette key "${m[1]}" at ${name}`);
  return `var(--palette-${m[1]})`;
};
for (const [k, val] of Object.entries(t.palette)) root.push(`  --palette-${k}: ${val};`);
flat(t.color, "color", (name, val) => colors.push(`  --${name}: ${resolvePalette(name, val)};`));

// yazı tipleri fontsource ile yerelden gelir ("Geist Variable"); token'daki aile yedek olarak kalır
v("font-sans", `"Geist Variable", ${t.font.family.sans}`);
v("font-mono", `"Geist Mono Variable", ${t.font.family.mono}`);
for (const [k, val] of Object.entries(t.font.weight)) v(`font-weight-${k}`, val);
for (const [k, val] of Object.entries(t.font.size)) v(`text-${k}`, val);
for (const [k, val] of Object.entries(t.font["line-height"])) v(`leading-${k}`, val);
for (const [k, val] of Object.entries(t.font["letter-spacing"])) v(`tracking-${k}`, val);

for (const [k, val] of Object.entries(t.space)) v(`spacing-${key(k)}`, val);

// yerleşim ölçüleri spacing ad alanına girer: w-sidebar-width, h-control-height-md, size-icon-lg ...
const L = t.layout;
for (const [k, val] of Object.entries(L)) {
  if (k === "breakpoint-mobile" || k === "breakpoint-medium") continue;
  if (val && typeof val === "object") flat(val, `spacing-${k}`, v);
  else v(`spacing-${k}`, val);
}
v("container-content", L["content-max"]);
v("container-content-narrow", L["content-max-narrow"]);
// mobil öncelikli: taban stil mobil, "desk:" masaüstü (tasarımdaki 860px sınırının bir üstü)
v("breakpoint-desk", `${parseInt(L["breakpoint-mobile"], 10) + 1}px`);
v("breakpoint-wide", `${parseInt(L["breakpoint-medium"], 10) + 1}px`);

for (const [k, val] of Object.entries(t.radius)) v(`radius-${k}`, val);
for (const [k, val] of Object.entries(t.shadow)) v(`shadow-${k}`, val);
for (const [k, val] of Object.entries(t.motion.ease)) v(`ease-${k}`, val);

// hareket süreleri: --dur-* değişkenleri ve dur-* sınıfları
for (const [k, val] of Object.entries(t.motion.duration)) {
  root.push(`  --dur-${k}: ${val};`);
  utils.push(`@utility dur-${k} {\n  transition-duration: var(--dur-${k});\n}`);
}
root.push(`  --stagger: ${t.motion["stagger-step"]};`);
root.push(`  --rise-distance: ${t.motion["rise-distance"]};`);
root.push(`  --press-scale: ${t.motion["press-scale"]};`);
root.push(`  --hover-lift: ${t.motion["hover-lift"]};`);
root.push(`  --card-lift: ${t.motion["card-lift"]};`);
root.push(`  --icon-scale: ${t.motion["icon-scale"]};`);
root.push(`  --more-turn: ${t.motion["more-turn"]};`);

for (const [k, val] of Object.entries(t.z)) {
  root.push(`  --z-${k}: ${val};`);
  utils.push(`@utility z-${k} {\n  z-index: var(--z-${k});\n}`);
}
for (const [k, val] of Object.entries(t["border-width"])) {
  root.push(`  --bw-${k}: ${val};`);
  utils.push(`@utility bw-${k} {\n  border-width: var(--bw-${k});\n}`);
}
for (const [k, val] of Object.entries(t.opacity)) {
  root.push(`  --opacity-${k}: ${val};`);
  utils.push(`@utility opacity-${k} {\n  opacity: var(--opacity-${k});\n}`);
}

const css = `/* OTOMATİK ÜRETİLDİ: src/styles/tokens.json → npm run tokens. Elle düzenleme. */
@theme {
${theme.join("\n")}
}

@theme inline {
${colors.join("\n")}
}

:root {
${root.join("\n")}
}

${utils.join("\n\n")}
`;
writeFileSync(out, css);
console.log(`tokens.css: ${theme.length + colors.length} tema değişkeni, ${utils.length} yardımcı`);

// favicon de token renklerinden üretilir (çözülmüş değerlerle, var() ile değil)
const literal = (ref) => t.palette[PALETTE_REF.exec(ref)[1]];
const pub = resolve(here, "../public");
mkdirSync(pub, { recursive: true });
writeFileSync(
  resolve(pub, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${literal(t.color.accent.default)}"/><text x="16" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="600" fill="${literal(t.color.accent.on)}">FF</text></svg>\n`,
);
