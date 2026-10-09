// npm start: kontrol et → derle → sunucuyu aç → tarayıcıyı aç.
// Her adım açık Türkçe mesaj verir; tüm çıktı data/son-calistirma.log dosyasına da yazılır
// (bir şey ters giderse bu dosya sorunun kendisini gösterir).
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "data"), { recursive: true });
const logPath = join(root, "data", "son-calistirma.log");
writeFileSync(logPath, `${new Date().toISOString()}\n`);
const log = { write: (d) => appendFileSync(logPath, d) };
const color = (c, s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);

function say(msg) {
  console.log(msg);
  log.write(msg + "\n");
}
function fail(msg, hint, output = "") {
  const tail = output.trim().split(/\r?\n/).slice(-40).join("\n");
  if (tail) console.error(tail);
  console.error(color("31", `\n✗ ${msg}`));
  if (hint) console.error(`  Ne yapmalı: ${hint}`);
  console.error(`  Ayrıntı: ${logPath}`);
  log.write(`\n${output}\n✗ ${msg}\n${hint ?? ""}\n`);
  process.exit(1);
}

say(`Full Follow başlıyor (Node ${process.versions.node}, ${process.platform})`);

// 1. Node sürümü
// better-sqlite3 ~12.11 sabit: 13.x'in Windows modülü Node 22.13'te hata vermeden çöküyor
const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  fail(`Node ${process.versions.node} eski; Node 22 ya da üstü gerekli`,
    "nodejs.org adresinden LTS sürümünü indirip kur, terminali kapatıp yeniden aç, sonra: npm start");
}

// 2. Bağımlılıklar ve SQLite modülü
const require = createRequire(join(root, "packages", "core", "package.json"));
if (!existsSync(join(root, "node_modules"))) fail("Bağımlılıklar kurulmamış", "önce: npm install");
// SQLite modülü ayrı süreçte denenir: yerel modül çökerse bu betik de sessizce kapanmasın
{
  const probe = spawnSync(process.execPath, ["-e", "const D=require('better-sqlite3');new D(':memory:').close()"], { cwd: join(root, "packages", "core"), encoding: "utf8" });
  if (probe.status !== 0) {
    fail(`SQLite modülü (better-sqlite3) açılamadı (çıkış kodu ${probe.status ?? probe.signal})`,
      "Node'u nodejs.org'dan LTS sürümüne güncelle; olmazsa node_modules klasörünü silip npm install yap", `${probe.stdout ?? ""}${probe.stderr ?? ""}`);
  }
}

/** Komutu sessizce çalıştırır; çıktıyı log'a yazar, hata olursa gösterir */
function step(title, args) {
  return new Promise((done) => {
    const t = Date.now();
    process.stdout.write(`• ${title}… `);
    const p = spawn(process.execPath, args, { cwd: root, env: process.env });
    let out = "";
    const keep = (d) => {
      out += d;
      log.write(d);
    };
    p.stdout.on("data", keep);
    p.stderr.on("data", keep);
    p.on("error", (e) => fail(`${title} başlatılamadı`, null, String(e)));
    p.on("close", (code) => {
      if (code !== 0) {
        console.log(color("31", "hata"));
        fail(`${title} başarısız oldu`, "yukarıdaki hata satırlarını Claude'a gönder", out);
        return;
      }
      console.log(color("32", `tamam (${((Date.now() - t) / 1000).toFixed(1)} sn)`));
      done();
    });
  });
}

const skipBuild = process.argv.includes("--no-build") || process.env.FF_SKIP_BUILD === "1";
if (!skipBuild) {
  const tsc = require.resolve("typescript/bin/tsc", { paths: [root] });
  await step("Arka uç derleniyor", [tsc, "-b", "packages/core", "packages/server", "packages/mcp"]);
  const npmCli = process.env.npm_execpath;
  if (npmCli && /\.c?js$/.test(npmCli)) {
    await step("Arayüz derleniyor", [npmCli, "run", "build", "-w", "@fullfollow/web"]);
  } else {
    // npm dışından çalıştırıldıysa vite'ı doğrudan çağır
    const web = join(root, "packages", "web");
    await step("Tasarım token'ları üretiliyor", [join(web, "scripts", "gen-tokens.mjs")]);
    await step("Arayüz derleniyor", [require.resolve("vite/bin/vite.js", { paths: [web] }), "build", web]);
  }
}

const main = join(root, "packages", "server", "dist", "main.js");
if (!existsSync(main)) fail("Sunucu derlenmemiş", "npm start'ı --no-build olmadan çalıştır");

// 3. Sunucu: çıktısı hem ekrana hem log'a
say("• Sunucu açılıyor…");
const server = spawn(process.execPath, [main], { cwd: root, env: { ...process.env, FF_OPEN: process.env.FF_OPEN ?? "1" } });
const pipe = (src, dst) => src.on("data", (d) => {
  dst.write(d);
  log.write(d);
});
pipe(server.stdout, process.stdout);
pipe(server.stderr, process.stderr);
server.on("close", (code, signal) => {
  // Yerel modül çökmesi kod yerine sinyal ya da Windows'ta 0xC0000005 gibi büyük bir kod döner
  const crashed = (code && code !== 130) || (signal && !["SIGINT", "SIGTERM"].includes(signal));
  if (crashed) console.error(color("31", `\n✗ Sunucu beklenmedik şekilde kapandı (${code ?? signal}). Ayrıntı: ${logPath}`));
  process.exit(code ?? (crashed ? 1 : 0));
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
