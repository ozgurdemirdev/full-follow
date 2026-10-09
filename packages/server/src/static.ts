import fs from "node:fs";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2",
};

/**
 * Web derlemesi `.br` ve `.gz` kopyalarını üretir (packages/web/vite.config.ts, precompress eklentisi).
 * Tarayıcı destekliyorsa hazır sıkıştırılmış dosya sunulur: ek paket yok, çalışırken CPU harcanmaz.
 * Adında hash olan /assets dosyaları bir yıl önbellekte kalır.
 */
export function precompressed(root: string) {
  const exists = new Map<string, boolean>();
  const has = (p: string) => {
    let v = exists.get(p);
    if (v === undefined) exists.set(p, (v = fs.existsSync(p)));
    return v;
  };
  return (req: any, res: any, next: any) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const rel = decodeURIComponent(req.path);
    if (rel.startsWith("/api") || rel.includes("..")) return next();
    const file = path.join(root, rel);
    const type = TYPES[path.extname(file)];
    if (!type || !has(file)) return next();
    const accept = String(req.headers["accept-encoding"] ?? "");
    const enc = /\bbr\b/.test(accept) && has(`${file}.br`) ? "br" : /\bgzip\b/.test(accept) && has(`${file}.gz`) ? "gzip" : null;
    if (rel.startsWith("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (!enc) return next();
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Encoding", enc);
    res.setHeader("Vary", "Accept-Encoding");
    res.sendFile(`${file}.${enc === "br" ? "br" : "gz"}`);
  };
}
