import "reflect-metadata";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

const red = (s: string) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s: string) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s);

function die(msg: string, hint?: string, err?: unknown): never {
  if (err) console.error(err);
  console.error(red(`\n✗ ${msg}`));
  if (hint) console.error(`  Ne yapmalı: ${hint}`);
  process.exit(1);
}

/** Tarayıcıda aç (npm start FF_OPEN=1 verir); hata olursa sessizce geç */
function openBrowser(url: string) {
  if (process.env.FF_OPEN !== "1") return;
  try {
    const [cmd, args]: [string, string[]] =
      process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
  } catch {
    /* tarayıcı açılamadı: adres zaten yazıldı */
  }
}

/** Port doluysa: zaten çalışan bir Full Follow mu? */
async function alreadyRunning(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok && ((await r.json()) as { ok?: boolean })?.ok === true;
  } catch {
    return false;
  }
}

async function load() {
  const [{ NestFactory }, core, app, auth] = await Promise.all([
    import("@nestjs/core"), import("@fullfollow/core"), import("./app.module"), import("./auth"),
  ]);
  return { NestFactory, core, AppModule: app.AppModule, authEnabled: auth.authEnabled };
}

async function bootstrap() {
  // Modüller burada yüklenir: eksik bağımlılık ya da bozuk SQLite modülü anlaşılır bir hataya döner
  let mods: Awaited<ReturnType<typeof load>>;
  try {
    mods = await load();
  } catch (e) {
    die("Sunucu modülleri yüklenemedi", "npm install çalıştır, sonra npm start (Node sürümünü değiştirdiysen önce node_modules klasörünü sil)", e);
  }
  mods.core.loadRootEnv();

  const port = Number(process.env.FF_PORT || 3000);
  // Şifre varsa yerel ağa (telefon) açılır; yoksa sadece bu bilgisayara
  const host = process.env.FF_HOST || (mods.authEnabled() ? "0.0.0.0" : "127.0.0.1");
  const url = `http://localhost:${port}`;

  let app: NestExpressApplication;
  try {
    // rota listesi gibi ayrıntılar yazılmaz; sadece uyarı ve hata
    app = await mods.NestFactory.create<NestExpressApplication>(mods.AppModule, { logger: ["error", "warn"] });
  } catch (e) {
    die(`Veritabanı ya da uygulama açılamadı (${mods.core.defaultDbPath()})`, "dosya başka bir programda kilitli olabilir; Full Follow'un başka bir penceresi açıksa kapat", e);
  }

  // Ctrl+C ve SIGTERM: sohbet CLI süreçleri de kapansın (onModuleDestroy)
  app.enableShutdownHooks();

  // Derlenmiş web arayüzü: hazır sıkıştırılmış (.br/.gz) dosyalar varsa onlar sunulur
  const webDist = path.resolve(__dirname, "../../web/dist");
  const index = path.join(webDist, "index.html");
  if (fs.existsSync(index)) {
    const { precompressed } = await import("./static");
    app.use(precompressed(webDist));
    app.useStaticAssets(webDist, { index: false });
    app.use((req: Request, res: Response, next: NextFunction) => {
      // index.html her seferinde tazelenir (yeni derleme hemen görünsün)
      if (req.method === "GET" && !req.path.startsWith("/api")) return res.setHeader("Cache-Control", "no-cache"), res.sendFile(index);
      next();
    });
  }

  try {
    await app.listen(port, host);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EADDRINUSE") {
      await app.close().catch(() => {});
      if (await alreadyRunning(port)) {
        console.log(green(`\nFull Follow zaten açık: ${url}`));
        openBrowser(url);
        process.exit(0);
      }
      die(`${port} portu başka bir program tarafından kullanılıyor`, `.env dosyasına FF_PORT=${port + 1} yaz ve tekrar npm start`);
    }
    die("Sunucu dinlemeye başlayamadı", undefined, e);
  }

  console.log(green(`\n  Full Follow hazır: ${url}\n`));
  if (host === "0.0.0.0") {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const n of list ?? []) if (n.family === "IPv4" && !n.internal) console.log(`  Telefondan (aynı ağ): http://${n.address}:${port}`);
    }
  } else {
    console.log("  Şifre (FF_PASSWORD) tanımlı değil: sadece bu bilgisayardan açılır.");
  }
  if (!fs.existsSync(index)) console.log("  Web arayüzü derlenmemiş; npm start ile derle (API: /api/health)");
  console.log("  Kapatmak için Ctrl+C.\n");
  openBrowser(url);
  scheduleBackup(mods.core.backupDb);
}

/** Günlük yedek (data/backups): açılışta ve açık kaldıkça 6 saatte bir kontrol; FF_BACKUP=0 kapatır */
function scheduleBackup(backupDb: (file?: string, keep?: number) => Promise<string | null>) {
  if (process.env.FF_BACKUP === "0") return;
  const keep = Number(process.env.FF_BACKUP_KEEP || 14);
  const run = () => backupDb(undefined, keep).then((f) => f && console.log(`  Yedek alındı: ${f}`)).catch((e) => console.warn("  Yedek alınamadı:", e?.message ?? e));
  void run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}

process.on("unhandledRejection", (e) => die("Beklenmeyen hata", undefined, e));
bootstrap().catch((e) => die("Sunucu başlatılamadı", undefined, e));
