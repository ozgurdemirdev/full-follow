// Kaynakta sabit (hardcoded) tasarım değeri var mı? Renk kodu, rgb/hsl, px ölçüsü ve
// Tailwind'in sayısal keyfi değerleri (w-[123px] gibi) yasak. Sadece tokens.json/tokens.css muaf.
// Taranan yerler: packages/web/src ve her modülün web klasörü (packages/modules/*/web).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const modulesDir = join(root, "modules");
const roots = [join(root, "web", "src"), ...(existsSync(modulesDir) ? readdirSync(modulesDir).map((m) => join(modulesDir, m, "web")).filter(existsSync) : [])];
const skip = new Set(["tokens.json", "tokens.css"]);
const rules = [
  [/#[0-9a-fA-F]{3,8}\b/, "renk kodu"],
  [/\b(rgba?|hsla?|oklch)\(/, "renk fonksiyonu"],
  [/\d+(\.\d+)?(px|rem|em|ms)\b/, "ölçü/süre"],
  [/[a-z]-\[[^\]]*\d[^\]]*\]/, "keyfi Tailwind değeri"],
];
// svg viewBox/path verisi ölçü değil; satırda sadece bunlar varsa yok say
const allowLine = /viewBox=|\sd="|strokeWidth=|cubic-bezier|grid-template|minmax\(|\bfr\b|aspect-|data-[a-z]/;

const errors = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(name) && !skip.has(name)) check(p);
  }
}
function check(file) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$|\/\*.*?\*\//g, "");
    for (const [re, what] of rules) {
      if (re.test(code) && !(what !== "renk kodu" && allowLine.test(code))) {
        errors.push(`${relative(root, file)}:${i + 1}  ${what}: ${code.trim().slice(0, 100)}`);
        break;
      }
    }
  });
}
roots.forEach(walk);
if (errors.length) {
  console.error(`Sabit tasarım değeri bulundu (token kullan):\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("token kontrolü: temiz");
