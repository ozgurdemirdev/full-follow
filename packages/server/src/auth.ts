import { BadRequestException, CanActivate, Controller, ExecutionContext, Injectable, Post, Get, Body, Req, Res, UnauthorizedException, HttpException } from "@nestjs/common";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

const COOKIE = "ff_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const password = () => process.env.FF_PASSWORD || "";
const secret = () => process.env.FF_COOKIE_SECRET || createHash("sha256").update(`ff:${password()}`).digest("hex");
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Şifre tanımlı değilse (sunucu sadece bu bilgisayara açılır) giriş istenmez */
export const authEnabled = () => password().length > 0;

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
}

export function validSession(header: string | undefined): boolean {
  const v = cookieValue(header, COOKIE);
  if (!v) return false;
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && Number(exp) > Date.now() && safeEqual(sig, sign(exp));
}

/** /api altındaki her şey oturum ister; giriş, çıkış ve sağlık kontrolü hariç */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    if (!authEnabled()) return true;
    const req = ctx.switchToHttp().getRequest();
    const path: string = req.path ?? req.url;
    if (path === "/api/login" || path === "/api/logout" || path === "/api/health" || path === "/api/me") return true;
    if (validSession(req.headers.cookie)) return true;
    throw new UnauthorizedException("giriş gerekli");
  }
}

const attempts = new Map<string, { n: number; reset: number }>();

@Controller("api")
export class AuthController {
  /** Oturum durumu: { auth: false } şifresiz mod, { auth: true, loggedIn } */
  @Get("me")
  me(@Req() req: Request) {
    return { auth: authEnabled(), loggedIn: !authEnabled() || validSession(req.headers.cookie) };
  }

  @Post("login")
  login(@Body() b: { password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!authEnabled()) return { ok: true };
    const ip = req.ip ?? "?";
    const a = attempts.get(ip);
    if (a && a.reset > Date.now() && a.n >= 8) throw new HttpException("çok fazla deneme, bir dakika bekle", 429);
    if (typeof b?.password !== "string") throw new BadRequestException("şifre gerekli");
    if (!safeEqual(b.password, password())) {
      attempts.set(ip, { n: (a && a.reset > Date.now() ? a.n : 0) + 1, reset: Date.now() + 60_000 });
      throw new UnauthorizedException("şifre yanlış");
    }
    attempts.delete(ip);
    const exp = String(Date.now() + MAX_AGE_MS);
    res.setHeader("Set-Cookie", `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_MS / 1000}`);
    return { ok: true };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  }
}
