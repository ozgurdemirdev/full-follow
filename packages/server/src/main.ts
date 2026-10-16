import "reflect-metadata";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import { BACKUP_CHECK_MS, DEFAULT_PORT, HEALTH_PROBE_TIMEOUT_MS, LOOPBACK_HOSTS } from "./constants";
import { m } from "./messages.start";

const red = (s: string) => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s);
const green = (s: string) => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s);

function die(msg: string, hint?: string, err?: unknown): never {
  if (err) console.error(err);
  console.error(red(m.failure(msg)));
  if (hint) console.error(m.hint(hint));
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
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(HEALTH_PROBE_TIMEOUT_MS) });
    return r.ok && ((await r.json()) as { ok?: boolean })?.ok === true;
  } catch {
    return false;
  }
}

async function load() {
  const [{ NestFactory }, core, app, auth, setup] = await Promise.all([
    import("@nestjs/core"), import("@fullfollow/core"), import("./app.module"), import("./auth"), import("./setup"),
  ]);
  return { NestFactory, core, AppModule: app.AppModule, authEnabled: auth.authEnabled, configureApp: setup.configureApp };
}

async function bootstrap() {
  // Modüller burada yüklenir: eksik bağımlılık ya da bozuk SQLite modülü anlaşılır bir hataya döner
  let mods: Awaited<ReturnType<typeof load>>;
  try {
    mods = await load();
  } catch (e) {
    die(m.modulesNotLoaded, m.modulesNotLoadedHint, e);
  }
  mods.core.loadRootEnv();

  const port = Number(process.env.FF_PORT || DEFAULT_PORT);
  // Şifre varsa yerel ağa (telefon) açılır; yoksa sadece bu bilgisayara
  const host = process.env.FF_HOST || (mods.authEnabled() ? "0.0.0.0" : "127.0.0.1");
  // without a password nothing but this computer may reach the panel: no setting opens it to the network
  if (!mods.authEnabled() && !LOOPBACK_HOSTS.includes(host)) die(m.openWithoutPassword(host), m.openWithoutPasswordHint);
  const url = `http://localhost:${port}`;

  let app: NestExpressApplication;
  try {
    // rota listesi gibi ayrıntılar yazılmaz; sadece uyarı ve hata
    app = await mods.NestFactory.create<NestExpressApplication>(mods.AppModule, { logger: ["error", "warn"], bodyParser: false });
    mods.configureApp(app);
  } catch (e) {
    die(m.dbOpenFailed(mods.core.defaultDbPath()), m.dbOpenFailedHint, e);
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
      if (req.method === "GET" && !req.path.startsWith("/api")) return res.setHeader("Cache-Control", "no-cache"), res.sendFile("index.html", { root: webDist });
      next();
    });
  }

  try {
    await app.listen(port, host);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EADDRINUSE") {
      await app.close().catch(() => {});
      if (await alreadyRunning(port)) {
        console.log(green(m.alreadyOpen(url)));
        openBrowser(url);
        process.exit(0);
      }
      die(m.portBusy(port), m.portBusyHint(port + 1));
    }
    die(m.listenFailed, undefined, e);
  }

  console.log(green(m.ready(url)));
  if (host === "0.0.0.0") {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const n of list ?? []) if (n.family === "IPv4" && !n.internal) console.log(m.phone(n.address, port));
    }
  } else {
    console.log(m.noPassword);
  }
  if (!fs.existsSync(index)) console.log(m.webNotBuilt);
  console.log(m.stopHint);
  openBrowser(url);
  scheduleBackup(mods.core.backupDb, mods.core.BACKUPS_KEPT);
}

/** Günlük yedek (data/backups): açılışta ve açık kaldıkça 6 saatte bir kontrol; FF_BACKUP=0 kapatır */
function scheduleBackup(backupDb: (file?: string, keep?: number) => Promise<string | null>, keptByDefault: number) {
  if (process.env.FF_BACKUP === "0") return;
  const keep = Number(process.env.FF_BACKUP_KEEP || keptByDefault);
  const run = () => backupDb(undefined, keep).then((f) => f && console.log(m.backupDone(f))).catch((e) => console.warn(m.backupFailed, e?.message ?? e));
  void run();
  setInterval(run, BACKUP_CHECK_MS).unref();
}

process.on("unhandledRejection", (e) => die(m.unexpected, undefined, e));
bootstrap().catch((e) => die(m.startFailed, undefined, e));
