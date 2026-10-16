import { BadRequestException, CanActivate, Controller, ExecutionContext, Injectable, Post, Get, Body, Req, Res, UnauthorizedException, HttpException } from "@nestjs/common";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { MIN_PASSWORD_LENGTH, SESSION_MAX_AGE_MS } from "./constants";
import { LoginThrottle } from "./login-throttle";
import { m } from "./messages";
import { bumpSessionEpoch, sessionEpoch, sessionSecret } from "./session-store";

const COOKIE = "ff_session";

const password = () => process.env.FF_PASSWORD || "";
const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * The signature of a session: the key is random (never derived from the password, so a captured cookie cannot be used to
 * guess it offline), and the signed text holds the epoch (logout raises it) and a digest of the password (changing it ends every session).
 */
const sign = (exp: string, epoch: number) => createHmac("sha256", sessionSecret()).update(`${exp}.${epoch}.${digest(password()).toString("hex")}`).digest("hex");

/** The cookie value of a new session */
function newSession(): string {
  const exp = String(Date.now() + SESSION_MAX_AGE_MS);
  const epoch = sessionEpoch();
  return `${exp}.${epoch}.${sign(exp, epoch)}`;
}

/** Compares fixed length digests, so neither the time nor an early length check tells how long the secret is */
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

/** Şifre tanımlı değilse (sunucu sadece bu bilgisayara açılır) giriş istenmez */
export const authEnabled = () => password().length > 0;

/** A password is set but shorter than MIN_PASSWORD_LENGTH (start warns when such a server listens beyond this computer) */
export const weakPassword = () => authEnabled() && [...password()].length < MIN_PASSWORD_LENGTH;

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
}

export function validSession(header: string | undefined): boolean {
  const v = cookieValue(header, COOKIE);
  if (!v) return false;
  const [exp, epoch, sig, extra] = v.split(".");
  const current = sessionEpoch();
  return !!exp && !!sig && extra === undefined && Number(exp) > Date.now() && epoch === String(current) && safeEqual(sig, sign(exp, current));
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
    throw new UnauthorizedException(m.auth.required);
  }
}

const throttle = new LoginThrottle();

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
    if (throttle.locked(ip)) throw new HttpException(m.auth.tooManyAttempts, 429);
    if (typeof b?.password !== "string") throw new BadRequestException(m.auth.passwordRequired);
    if (!safeEqual(b.password, password())) {
      throttle.failed(ip);
      throw new UnauthorizedException(m.auth.wrongPassword);
    }
    throttle.succeeded(ip);
    res.setHeader("Set-Cookie", `${COOKIE}=${newSession()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_MS / 1000}`);
    return { ok: true };
  }

  /** Ends every session, on every device; only a logged in request may do that, so a stranger cannot log the owner out */
  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (authEnabled() && validSession(req.headers.cookie)) bumpSessionEpoch();
    res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  }
}
