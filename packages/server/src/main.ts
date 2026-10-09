import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { loadRootEnv } from "@fullfollow/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppModule } from "./app.module";
import { authEnabled } from "./auth";

async function bootstrap() {
  loadRootEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["error", "warn", "log"] });

  // Derlenmiş web arayüzü varsa aynı port üzerinden sun (SPA: bilinmeyen yollar index.html'e düşer)
  const webDist = path.resolve(__dirname, "../../web/dist");
  const index = path.join(webDist, "index.html");
  if (fs.existsSync(index)) {
    app.useStaticAssets(webDist);
    app.use((req: any, res: any, next: any) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) return res.sendFile(index);
      next();
    });
  }

  const port = Number(process.env.FF_PORT || 3000);
  // Şifre varsa yerel ağa (telefon) açılır; yoksa sadece bu bilgisayara
  const host = process.env.FF_HOST || (authEnabled() ? "0.0.0.0" : "127.0.0.1");
  await app.listen(port, host);

  console.log(`Full Follow: http://localhost:${port}`);
  if (host === "0.0.0.0") {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const n of list ?? []) if (n.family === "IPv4" && !n.internal) console.log(`  yerel ağ: http://${n.address}:${port}`);
    }
  } else {
    console.log("  Şifre (FF_PASSWORD) tanımlı olmadığı için sadece bu bilgisayardan erişilebilir.");
  }
  if (!fs.existsSync(index)) console.log("  (web arayüzü henüz derlenmedi; API: /api/health)");
}

bootstrap().catch((e) => {
  console.error("Sunucu başlatılamadı:", e);
  process.exit(1);
});
